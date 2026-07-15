import { createServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { walletMonitor } from "./lib/walletMonitor";

// ─── HTTP server ──────────────────────────────────────────────────────────────

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

// ─── WebSocket server for real-time wallet updates ────────────────────────────

const wss = new WebSocketServer({ noServer: true });

// Track which address each connected WS client is subscribed to
const wsAddressMap = new WeakMap<WebSocket, string>();

server.on("upgrade", (request, socket, head) => {
  const url = request.url ?? "";
  if (url === "/api/wallet-ws" || url.startsWith("/api/wallet-ws?")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws) => {
  const ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        type?: string;
        address?: string;
      };

      if (msg.type === "subscribe" && msg.address && ADDRESS_RE.test(msg.address)) {
        // Unsubscribe from previous address if any
        const prev = wsAddressMap.get(ws);
        if (prev) walletMonitor.removeClient(prev, ws);

        wsAddressMap.set(ws, msg.address);
        walletMonitor.addClient(msg.address, ws);
        logger.info({ address: msg.address }, "App WS client subscribed");

        // Ping to keep connection alive
        ws.send(JSON.stringify({ type: "subscribed", address: msg.address }));
      } else if (msg.type === "unsubscribe") {
        const addr = wsAddressMap.get(ws);
        if (addr) {
          walletMonitor.removeClient(addr, ws);
          wsAddressMap.delete(ws);
        }
      } else if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      // Ignore bad JSON
    }
  });

  ws.on("close", () => {
    const addr = wsAddressMap.get(ws);
    if (addr) {
      walletMonitor.removeClient(addr, ws);
      wsAddressMap.delete(ws);
    }
  });

  ws.on("error", (err) => {
    logger.warn({ err: (err as Error).message }, "App WS client error");
  });
});

// ─── Start listening ──────────────────────────────────────────────────────────

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
