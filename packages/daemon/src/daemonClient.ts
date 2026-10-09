import { WebSocket } from "ws";
import type {
  ClientToServerMessage,
  HostCredential,
  RelayDeliveryMessage,
  ServerToClientMessage
} from "@collaborative-grill/shared";
import { createAgentPool } from "./agentPool.js";
import { buildDaemonConnectMessage, buildDaemonDisconnectMessage } from "./messages.js";
import { createRelayRouter } from "./relayRouter.js";
import type { AgentSdkAdapter } from "./sdkAdapter.js";

export interface DaemonClientOptions {
  /** The Server's WebSocket endpoint, e.g. `ws://localhost:4000/ws`. */
  serverUrl: string;
  /** This Daemon's Host credential, read from environment or setup. */
  hostCredential: HostCredential;
  /**
   * The Rooms this Daemon serves; one `daemon-connect` is sent per id on
   * connect. Static Room discovery is a stopgap for ticket 4 - learning a
   * Host's Rooms from the Server is integration ticket 7's job.
   */
  roomIds: string[];
  sdkAdapter: AgentSdkAdapter;
  /** Injectable for tests; defaults to a real `ws` WebSocket. */
  createSocket?: (url: string) => WebSocket;
  onError?: (error: Error) => void;
}

export interface DaemonClient {
  /** Opens the WebSocket connection and announces every configured Room. Resolves once open. */
  connect(): Promise<void>;
  close(): void;
}

/**
 * The Daemon's Server connection: one WebSocket, `daemon-connect` per
 * configured Room, an Agent pool keyed by Room id, and a Relay router
 * that turns each incoming `relay-delivery` into exactly one outgoing
 * `agent-publication`.
 */
export function createDaemonClient(options: DaemonClientOptions): DaemonClient {
  const pool = createAgentPool(options.sdkAdapter);
  let socket: WebSocket | undefined;

  function send(message: ClientToServerMessage): void {
    socket?.send(JSON.stringify(message));
  }

  const router = createRelayRouter(pool, options.hostCredential, send);

  function reportError(error: unknown): void {
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
  }

  function handleMessage(raw: string): void {
    let message: ServerToClientMessage;
    try {
      message = JSON.parse(raw) as ServerToClientMessage;
    } catch {
      reportError(new Error("Received malformed message from Server"));
      return;
    }

    if (message.type === "relay-delivery") {
      void router.routeRelayDelivery(message as RelayDeliveryMessage).catch(reportError);
    }
  }

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url));
      const nextSocket = createSocket(options.serverUrl);
      socket = nextSocket;

      let settled = false;

      nextSocket.on("open", () => {
        for (const roomId of options.roomIds) {
          send(buildDaemonConnectMessage(roomId, options.hostCredential));
        }
        settled = true;
        resolve();
      });

      nextSocket.on("message", (data: unknown) => {
        handleMessage(String(data));
      });

      nextSocket.on("error", (error: Error) => {
        reportError(error);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    });
  }

  function close(): void {
    if (!socket) {
      return;
    }
    for (const roomId of options.roomIds) {
      send(buildDaemonDisconnectMessage(roomId, options.hostCredential));
    }
    socket.close();
    socket = undefined;
  }

  return { connect, close };
}
