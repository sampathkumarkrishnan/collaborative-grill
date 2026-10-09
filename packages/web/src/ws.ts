import type {
  ClientToServerMessage,
  ServerToClientMessage,
  TranscriptEntry
} from "@collaborative-grill/shared";
import { getServerWsUrl } from "./config.js";

/**
 * The subset of the browser `WebSocket` interface the Room client needs.
 * Injectable so tests can supply a fake socket instead of a real connection
 * (per "mock Server" in the ticket - no real network in unit tests).
 */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "close", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

export type SocketFactory = (url: string) => SocketLike;

function defaultSocketFactory(url: string): SocketLike {
  return new WebSocket(url) as unknown as SocketLike;
}

export interface RoomSocketHandlers {
  /** A new Transcript entry (Reply, Relay, or Agent) for this Room. */
  onTranscriptEntry: (entry: TranscriptEntry) => void;
  /** The Room's Daemon connectivity changed. */
  onPresence: (daemonConnected: boolean) => void;
  /** The Server rejected the last message this client sent. */
  onError?: (message: string) => void;
}

/**
 * Subscribes one Room to live Transcript and Daemon presence updates over
 * the Server's single `/ws` endpoint (`docs/protocol.md`). The web app only
 * ever sends `subscribe`; `daemon-connect`/`disconnect` and
 * `agent-publication` are the Daemon's messages, not the web app's.
 */
export class RoomSocketClient {
  private socket: SocketLike | null = null;

  constructor(
    private readonly url: string = getServerWsUrl(),
    private readonly createSocket: SocketFactory = defaultSocketFactory
  ) {}

  connect(roomId: string, handlers: RoomSocketHandlers): void {
    const socket = this.createSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.send({ type: "subscribe", roomId });
    });

    socket.addEventListener("message", (event) => {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      let message: ServerToClientMessage;
      try {
        message = JSON.parse(raw) as ServerToClientMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case "transcript-entry": {
          if (message.roomId === roomId) {
            handlers.onTranscriptEntry(message.entry);
          }
          break;
        }
        case "presence": {
          if (message.roomId === roomId) {
            handlers.onPresence(message.daemonConnected);
          }
          break;
        }
        case "error": {
          handlers.onError?.(message.message);
          break;
        }
        default: {
          // relay-delivery is Server -> Daemon only; the web client never receives it.
          break;
        }
      }
    });
  }

  private send(message: ClientToServerMessage): void {
    this.socket?.send(JSON.stringify(message));
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}
