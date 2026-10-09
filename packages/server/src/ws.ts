import type { Server as HttpServer } from "node:http";
import type { RoomModule } from "@collaborative-grill/room";
import type { ClientToServerMessage } from "@collaborative-grill/shared";
import { WebSocketServer } from "ws";
import type { BroadcastHub } from "./hub.js";

/**
 * WebSocket hub: subscribe, Daemon connect/disconnect, Agent publication,
 * and Relay delivery to the Room's Daemon socket only.
 */
export function attachWebSocketServer(
  httpServer: HttpServer,
  roomModule: RoomModule,
  hub: BroadcastHub
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      let message: ClientToServerMessage;
      try {
        message = JSON.parse(raw.toString()) as ClientToServerMessage;
      } catch {
        hub.send(socket, { type: "error", message: "Malformed message" });
        return;
      }

      switch (message.type) {
        case "subscribe": {
          hub.subscribe(socket, message.roomId);
          break;
        }
        case "daemon-connect": {
          const ok = roomModule.daemonConnect(message.roomId, message.hostCredential, (delivery) => {
            hub.send(socket, {
              type: "relay-delivery",
              roomId: delivery.roomId,
              relayId: delivery.relayId,
              payload: delivery.payload
            });
          });
          if (!ok) {
            hub.send(socket, { type: "error", message: "Unknown Room or Host credential" });
            break;
          }
          hub.registerDaemon(message.roomId, socket, message.hostCredential);
          hub.broadcast(message.roomId, {
            type: "presence",
            roomId: message.roomId,
            daemonConnected: true
          });
          break;
        }
        case "daemon-disconnect": {
          const ok = roomModule.daemonDisconnect(message.roomId, message.hostCredential);
          if (!ok) {
            hub.send(socket, { type: "error", message: "Unknown Room or Host credential" });
            break;
          }
          hub.unregisterDaemon(message.roomId);
          hub.broadcast(message.roomId, {
            type: "presence",
            roomId: message.roomId,
            daemonConnected: false
          });
          break;
        }
        case "agent-publication": {
          const result = roomModule.publishAgentMessage(
            message.roomId,
            message.hostCredential,
            message.body
          );
          if (!result.ok) {
            hub.send(socket, { type: "error", message: "Unknown Room or Host credential" });
            break;
          }
          hub.broadcast(message.roomId, {
            type: "transcript-entry",
            roomId: message.roomId,
            entry: result.entry
          });
          break;
        }
        default: {
          hub.send(socket, { type: "error", message: "Unknown message type" });
        }
      }
    });

    socket.on("close", () => {
      hub.unsubscribe(socket);
      for (const binding of hub.unbindDaemonSocket(socket)) {
        roomModule.daemonDisconnect(binding.roomId, binding.hostCredential);
        hub.broadcast(binding.roomId, {
          type: "presence",
          roomId: binding.roomId,
          daemonConnected: false
        });
      }
    });
  });

  return wss;
}
