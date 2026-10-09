import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type {
  ClientToServerMessage,
  ServerToClientMessage
} from "@collaborative-grill/shared";
import type { RoomStore } from "./store.js";

interface Subscription {
  socket: WebSocket;
  roomId: string;
}

/**
 * WebSocket hub: subscribe, Daemon connect/disconnect, and Agent
 * publication. Transcript and presence broadcasts come from Room store
 * listeners so HTTP posts and Daemon messages share one fan-out path.
 * Relay delivery to the Daemon socket belongs to the Server/Room
 * integration ticket.
 */
export function attachWebSocketServer(httpServer: HttpServer, store: RoomStore): WebSocketServer {
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

  store.addTranscriptListener((roomId, entry) => {
    broadcastToRoom(roomId, { type: "transcript-entry", roomId, entry });
  });
  store.addPresenceListener((roomId, daemonConnected) => {
    broadcastToRoom(roomId, { type: "presence", roomId, daemonConnected });
  });

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
          }
          break;
        }
        case "daemon-disconnect": {
          const ok = store.setDaemonConnected(message.roomId, message.hostCredential, false);
          if (!ok) {
            send(socket, { type: "error", message: "Unknown Room or Host credential" });
          }
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
