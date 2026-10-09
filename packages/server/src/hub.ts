import { WebSocket } from "ws";
import type { HostCredential, ServerToClientMessage } from "@collaborative-grill/shared";

interface Subscription {
  socket: WebSocket;
  roomId: string;
}

interface DaemonBinding {
  socket: WebSocket;
  hostCredential: HostCredential;
}

export interface BroadcastHub {
  subscribe(socket: WebSocket, roomId: string): void;
  unsubscribe(socket: WebSocket): void;
  send(socket: WebSocket, message: ServerToClientMessage): void;
  broadcast(roomId: string, message: ServerToClientMessage): void;
  registerDaemon(roomId: string, socket: WebSocket, hostCredential: HostCredential): void;
  unregisterDaemon(roomId: string): void;
  /** Rooms whose Daemon binding was this socket. */
  unbindDaemonSocket(socket: WebSocket): (DaemonBinding & { roomId: string })[];
}

export function createBroadcastHub(): BroadcastHub {
  const subscriptions: Subscription[] = [];
  const daemonByRoomId = new Map<string, DaemonBinding>();

  function send(socket: WebSocket, message: ServerToClientMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  return {
    subscribe(socket, roomId) {
      subscriptions.push({ socket, roomId });
    },
    unsubscribe(socket) {
      for (let i = subscriptions.length - 1; i >= 0; i--) {
        if (subscriptions[i]?.socket === socket) {
          subscriptions.splice(i, 1);
        }
      }
    },
    send,
    broadcast(roomId, message) {
      for (const subscription of subscriptions) {
        if (subscription.roomId === roomId) {
          send(subscription.socket, message);
        }
      }
    },
    registerDaemon(roomId, socket, hostCredential) {
      daemonByRoomId.set(roomId, { socket, hostCredential });
    },
    unregisterDaemon(roomId) {
      daemonByRoomId.delete(roomId);
    },
    unbindDaemonSocket(socket) {
      const released: (DaemonBinding & { roomId: string })[] = [];
      for (const [roomId, binding] of daemonByRoomId) {
        if (binding.socket === socket) {
          released.push({ roomId, ...binding });
          daemonByRoomId.delete(roomId);
        }
      }
      return released;
    }
  };
}
