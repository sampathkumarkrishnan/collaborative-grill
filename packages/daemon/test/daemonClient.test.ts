import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import type {
  AgentPublicationMessage,
  ClientToServerMessage,
  DaemonConnectMessage,
  DaemonDisconnectMessage,
  RelayDeliveryMessage
} from "@collaborative-grill/shared";
import { createDaemonClient, type DaemonClient } from "../src/daemonClient.js";
import { createFakeSdkAdapter } from "../src/sdkAdapter.js";

/**
 * Minimal mock Server for Daemon tests: a bare `ws` server that records
 * every message it receives and lets tests push `relay-delivery` events
 * to whichever socket connects. Ticket 4 explicitly scopes this module to
 * test against a mock Server, not the real stub Server in
 * `packages/server` (relay delivery wiring there is ticket 7/8's job).
 */
function startMockServer(): Promise<{ wss: WebSocketServer; url: string }> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0 }, () => {
      const address = wss.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ wss, url: `ws://localhost:${port}` });
    });
  });
}

/** Connects a Daemon client against `url`, recording every message the mock Server receives. */
async function connectDaemonClient(
  wss: WebSocketServer,
  url: string,
  roomIds: string[]
): Promise<{ client: DaemonClient; serverSocket: WebSocket; received: ClientToServerMessage[] }> {
  const received: ClientToServerMessage[] = [];
  const connection = new Promise<WebSocket>((resolve) => {
    wss.on("connection", (socket) => {
      socket.on("message", (raw) => {
        received.push(JSON.parse(raw.toString()) as ClientToServerMessage);
      });
      resolve(socket);
    });
  });

  const client = createDaemonClient({
    serverUrl: url,
    hostCredential: "cred-1",
    roomIds,
    sdkAdapter: createFakeSdkAdapter()
  });

  await client.connect();
  const serverSocket = await connection;

  return { client, serverSocket, received };
}

function sendRelayDelivery(serverSocket: WebSocket, delivery: RelayDeliveryMessage): void {
  serverSocket.send(JSON.stringify(delivery));
}

function publicationsFrom(received: ClientToServerMessage[]): AgentPublicationMessage[] {
  return received.filter(
    (message): message is AgentPublicationMessage => message.type === "agent-publication"
  );
}

describe("createDaemonClient", () => {
  let wss: WebSocketServer | undefined;

  afterEach(() => {
    wss?.close();
    wss = undefined;
  });

  it("connects with the Host credential and sends daemon-connect for every configured Room", async () => {
    const started = await startMockServer();
    wss = started.wss;

    const { received, client } = await connectDaemonClient(wss, started.url, ["room-1", "room-2"]);

    await vi.waitFor(() => expect(received).toHaveLength(2));
    expect(received).toEqual([
      { type: "daemon-connect", roomId: "room-1", hostCredential: "cred-1" },
      { type: "daemon-connect", roomId: "room-2", hostCredential: "cred-1" }
    ] satisfies DaemonConnectMessage[]);

    client.close();
  });

  it("sends daemon-disconnect for every configured Room on close", async () => {
    const started = await startMockServer();
    wss = started.wss;

    const { received, client } = await connectDaemonClient(wss, started.url, ["room-1"]);
    await vi.waitFor(() => expect(received).toHaveLength(1));

    client.close();

    await vi.waitFor(() => expect(received).toHaveLength(2));
    expect(received[1]).toEqual({
      type: "daemon-disconnect",
      roomId: "room-1",
      hostCredential: "cred-1"
    } satisfies DaemonDisconnectMessage);
  });

  it("routes a relay-delivery to the Room's Agent and publishes one Agent message, no partial stream", async () => {
    const started = await startMockServer();
    wss = started.wss;

    const { received, serverSocket, client } = await connectDaemonClient(wss, started.url, ["room-1"]);
    await vi.waitFor(() => expect(received).toHaveLength(1));

    sendRelayDelivery(serverSocket, {
      type: "relay-delivery",
      roomId: "room-1",
      relayId: "relay-1",
      payload: "first question"
    });

    await vi.waitFor(() => expect(publicationsFrom(received)).toHaveLength(1));
    const [published] = publicationsFrom(received);
    expect(published).toMatchObject({
      type: "agent-publication",
      roomId: "room-1",
      hostCredential: "cred-1"
    });
    expect(published?.body).toContain("first question");

    client.close();
  });

  it("reuses one Agent per Room across follow-up Relays, delivered one publication at a time", async () => {
    const started = await startMockServer();
    wss = started.wss;

    const { received, serverSocket, client } = await connectDaemonClient(wss, started.url, ["room-1"]);
    await vi.waitFor(() => expect(received).toHaveLength(1));

    sendRelayDelivery(serverSocket, {
      type: "relay-delivery",
      roomId: "room-1",
      relayId: "relay-1",
      payload: "first question"
    });
    await vi.waitFor(() => expect(publicationsFrom(received)).toHaveLength(1));

    sendRelayDelivery(serverSocket, {
      type: "relay-delivery",
      roomId: "room-1",
      relayId: "relay-2",
      payload: "follow up question"
    });
    await vi.waitFor(() => expect(publicationsFrom(received)).toHaveLength(2));

    const [first, second] = publicationsFrom(received);
    expect(first?.body).toContain("reply 1");
    expect(second?.body).toContain("reply 2");
    expect(second?.body).toContain("follow up question");

    client.close();
  });
});
