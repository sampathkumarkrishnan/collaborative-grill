import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { ServerToClientMessage } from "@collaborative-grill/shared";
import { WebSocket } from "ws";

/** Starts `server` on an ephemeral loopback port and resolves with that port. */
export async function listen(server: HttpServer): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  return (server.address() as AddressInfo).port;
}

function openSocket(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

/**
 * Buffers every `ServerToClientMessage` a socket receives (via a single
 * persistent `message` listener) so callers can `next()` them one at a
 * time in arrival order, including ones that already arrived before
 * `next()` was called. Unlike pairing a fresh `socket.once("message", ...)`
 * per expected message, this can't drop a message that arrives in the gap
 * between two `.once` registrations - the risk with two messages that can
 * land back-to-back (e.g. a Relay's broadcast immediately followed by the
 * Daemon's Agent publication).
 */
export interface MessageQueue {
  next(): Promise<ServerToClientMessage>;
  /** Closes the underlying socket. Callers must do this before closing the HTTP server. */
  close(): Promise<void>;
}

function createMessageQueue(socket: WebSocket): MessageQueue {
  const buffered: ServerToClientMessage[] = [];
  const waiting: ((message: ServerToClientMessage) => void)[] = [];

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString()) as ServerToClientMessage;
    const next = waiting.shift();
    if (next) {
      next(message);
    } else {
      buffered.push(message);
    }
  });

  return {
    next(): Promise<ServerToClientMessage> {
      const message = buffered.shift();
      if (message) {
        return Promise.resolve(message);
      }
      return new Promise((resolve) => {
        waiting.push(resolve);
      });
    },
    close(): Promise<void> {
      if (socket.readyState === WebSocket.CLOSED) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        socket.once("close", () => resolve());
        socket.close();
      });
    }
  };
}

/** Opens a WebSocket, subscribes it to `roomId`, and returns a queue of what it receives. */
export async function connectSubscriber(wsUrl: string, roomId: string): Promise<MessageQueue> {
  const socket = await openSocket(wsUrl);
  const queue = createMessageQueue(socket);
  socket.send(JSON.stringify({ type: "subscribe", roomId }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  return queue;
}

/** Opens a bare WebSocket (no subscribe) for sending raw Daemon-style messages in tests. */
export { openSocket };
