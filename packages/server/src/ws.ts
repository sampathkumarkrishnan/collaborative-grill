import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type {
  ClientToServerMessage,
  ServerToClientMessage
} from "@collaborative-grill/shared";
import type { MockRoomStore } from "./store.js";

interface Subscription {
  socket: WebSocket;
  roomId: string;
}

/**
 * Minimal mock WebSocket wiring for local development: subscribers get
 * presence broadcasts, and `agent-publication` from a Daemon is appended
 * and broadcast. Relay delivery to the Daemon connection is left as a
 * `// TODO` for the real Room/Server tickets, which will also need a
 * registry of which socket holds which Room's Daemon connection.
 */
export function attachWebSocketServer(httpServer: HttpServer, store: MockRoomStore): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const subscriptions: Subscription[] = [];

  function send(socket: WebSocket, message: ServerToClientMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function broadcastToRoom(roomId: string, message: ServerToClientMessage): void {
    for (const subscription of subscriptions) {
      if (subscription.roomId === roomId) {
        send(subscription.socket, message);
      }
    }
  }

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      let message: ClientToServerMessage;
      try {
        message = JSON.parse(raw.toString()) as ClientToServerMessage;
      } catch {
        send(socket, { type: "error", message: "Malformed message" });
        return;
      }

      switch (message.type) {
        case "subscribe": {
          subscriptions.push({ socket, roomId: message.roomId });
          break;
        }
        case "daemon-connect": {
          const ok = store.setDaemonConnected(message.roomId, message.hostCredential, true);
          if (!ok) {
            send(socket, { type: "error", message: "Unknown Room or Host credential" });
            break;
          }
          broadcastToRoom(message.roomId, {
            type: "presence",
            roomId: message.roomId,
            daemonConnected: true
          });
          break;
        }
        case "daemon-disconnect": {
          const ok = store.setDaemonConnected(message.roomId, message.hostCredential, false);
          if (!ok) {
            send(socket, { type: "error", message: "Unknown Room or Host credential" });
            break;
          }
          broadcastToRoom(message.roomId, {
            type: "presence",
            roomId: message.roomId,
            daemonConnected: false
          });
          break;
        }
        case "agent-publication": {
          const ok = store.publishAgentEntry(
            message.roomId,
            message.hostCredential,
            message.body
          );
          if (!ok) {
            send(socket, { type: "error", message: "Unknown Room or Host credential" });
            break;
          }
          const room = store.getRoomById(message.roomId);
          const entry = room?.transcript.at(-1);
          if (entry) {
            broadcastToRoom(message.roomId, {
              type: "transcript-entry",
              roomId: message.roomId,
              entry
            });
          }
          break;
        }
        default: {
          send(socket, { type: "error", message: "Unknown message type" });
        }
      }
    });

    socket.on("close", () => {
      const index = subscriptions.findIndex((subscription) => subscription.socket === socket);
      if (index !== -1) {
        subscriptions.splice(index, 1);
      }
    });
  });

  return wss;
}
