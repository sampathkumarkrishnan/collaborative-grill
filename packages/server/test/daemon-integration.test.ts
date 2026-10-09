import { createServer, type Server as HttpServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createDaemonClient, createFakeSdkAdapter, type DaemonClient } from "@collaborative-grill/daemon";
import { createApp } from "../src/app.js";
import { createServerRuntime, type ServerRuntime } from "../src/runtime.js";
import { attachWebSocketServer } from "../src/ws.js";
import { connectSubscriber, listen, type MessageQueue } from "./wsTestHelpers.js";

/**
 * Ticket 7 (`#10`): connects the real `@collaborative-grill/daemon`
 * package to the real Server (HTTP + WebSocket hub + Room module +
 * SQLite), with the Daemon's fake SDK adapter standing in for Cursor
 * (CI has no `CURSOR_API_KEY`). Verifies the full wire round trip end to
 * end rather than either side's mock of the other.
 */
describe("real Daemon against the real Server", () => {
  let runtime: ServerRuntime;
  let server: HttpServer;
  let origin: string;
  let wsUrl: string;
  let daemonClient: DaemonClient | undefined;
  const subscribers: MessageQueue[] = [];

  afterEach(async () => {
    daemonClient?.close();
    daemonClient = undefined;

    // Every WebSocket must be closed before the HTTP server, or
    // `server.close()`'s callback never fires with a connection still open.
    await Promise.all(subscribers.map((subscriber) => subscriber.close()));
    subscribers.length = 0;

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    runtime.close();
  });

  async function startServer(): Promise<void> {
    runtime = createServerRuntime();
    const app = createApp(runtime.room, runtime.hub);
    server = createServer(app);
    attachWebSocketServer(server, runtime.room, runtime.hub);
    const port = await listen(server);
    origin = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  }

  function connectRealDaemon(roomId: string, hostCredential: string): DaemonClient {
    const client = createDaemonClient({
      serverUrl: wsUrl,
      hostCredential,
      roomIds: [roomId],
      sdkAdapter: createFakeSdkAdapter()
    });
    daemonClient = client;
    return client;
  }

  async function createRoom(): Promise<{ roomId: string; hostCredential: string; link: string }> {
    const created = await request(origin).post("/api/rooms").send({ topic: "Topic A" });
    return {
      roomId: created.body.room.id as string,
      hostCredential: created.body.hostCredential as string,
      link: created.body.room.link as string
    };
  }

  async function subscribe(roomId: string): Promise<MessageQueue> {
    const subscriber = await connectSubscriber(wsUrl, roomId);
    subscribers.push(subscriber);
    return subscriber;
  }

  async function postRelay(roomId: string, hostCredential: string, body: string) {
    return request(origin)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "relay", hostCredential, body });
  }

  it("connects with the Host credential and the Server marks that Room's Daemon present", async () => {
    await startServer();
    const { roomId, hostCredential, link } = await createRoom();

    const subscriber = await subscribe(roomId);
    const daemon = connectRealDaemon(roomId, hostCredential);
    await daemon.connect();

    expect(await subscriber.next()).toEqual({ type: "presence", roomId, daemonConnected: true });

    const linkToken = link.split("/").pop()!;
    const joined = await request(origin).get(`/api/rooms/by-link/${linkToken}`);
    expect(joined.body.room.daemonConnected).toBe(true);
  });

  it("delivers a Host Relay to the real Daemon's Agent; the Agent publication lands in the Transcript and reaches subscribed web clients", async () => {
    await startServer();
    const { roomId, hostCredential } = await createRoom();

    const subscriber = await subscribe(roomId);
    const daemon = connectRealDaemon(roomId, hostCredential);
    await daemon.connect();
    await subscriber.next(); // presence: daemonConnected true

    const posted = await postRelay(roomId, hostCredential, "@agent   summarize the thread   ");
    expect(posted.status).toBe(201);
    expect(posted.body.entry.kind).toBe("relay");

    const relayBroadcast = await subscriber.next();
    expect(relayBroadcast).toMatchObject({ type: "transcript-entry", roomId });

    // The real Daemon received relay-delivery, ran the fake Agent, and
    // published the result back to the Server on its own - no manual
    // publish call here.
    const agentBroadcast = await subscriber.next();
    expect(agentBroadcast).toMatchObject({ type: "transcript-entry", roomId });
    if (agentBroadcast.type === "transcript-entry") {
      expect(agentBroadcast.entry.kind).toBe("agent");
      expect(agentBroadcast.entry.body).toContain("summarize the thread");
    }

    const transcript = await request(origin).get(`/api/rooms/${roomId}/transcript`);
    expect(transcript.body.transcript.map((entry: { kind: string }) => entry.kind)).toEqual([
      "relay",
      "agent"
    ]);
  });

  it("reuses one Agent conversation across follow-up Relays through the real Daemon", async () => {
    await startServer();
    const { roomId, hostCredential } = await createRoom();

    const subscriber: MessageQueue = await subscribe(roomId);
    const daemon = connectRealDaemon(roomId, hostCredential);
    await daemon.connect();
    await subscriber.next(); // presence

    await postRelay(roomId, hostCredential, "@agent first question");
    await subscriber.next(); // relay broadcast
    const firstMessage = await subscriber.next(); // agent broadcast

    await postRelay(roomId, hostCredential, "@agent follow up");
    await subscriber.next(); // relay broadcast
    const secondMessage = await subscriber.next(); // agent broadcast

    expect(firstMessage.type).toBe("transcript-entry");
    expect(secondMessage.type).toBe("transcript-entry");
    if (firstMessage.type === "transcript-entry" && secondMessage.type === "transcript-entry") {
      // The fake adapter's turn count only increments across sends on the
      // *same* cached Agent (`createAgentPool`), so "reply 2" proves the
      // second Relay reused the first Relay's Agent conversation.
      expect(firstMessage.entry.body).toContain("reply 1");
      expect(secondMessage.entry.body).toContain("reply 2");
    }
  });

  it("rejects a Relay while the Daemon is disconnected on the integrated stack, leaving the Transcript unchanged", async () => {
    await startServer();
    const { roomId, hostCredential } = await createRoom();

    // No Daemon ever connects for this Room.
    const posted = await postRelay(roomId, hostCredential, "@agent do something");

    expect(posted.status).toBe(409);
    expect(posted.body).toEqual({ ok: false, error: "daemon-disconnected" });

    const transcript = await request(origin).get(`/api/rooms/${roomId}/transcript`);
    expect(transcript.body.transcript).toEqual([]);
  });

  it("marks the Daemon absent again once it disconnects, so a later Relay is rejected", async () => {
    await startServer();
    const { roomId, hostCredential } = await createRoom();

    const subscriber = await subscribe(roomId);
    const daemon = connectRealDaemon(roomId, hostCredential);
    await daemon.connect();
    await subscriber.next(); // presence: connected

    daemon.close();
    // Resolving confirms the Server already processed daemon-disconnect
    // and broadcast the updated presence before we post the next Relay.
    expect(await subscriber.next()).toEqual({
      type: "presence",
      roomId,
      daemonConnected: false
    });

    const posted = await postRelay(roomId, hostCredential, "@agent too late");
    expect(posted.status).toBe(409);
    expect(posted.body).toEqual({ ok: false, error: "daemon-disconnected" });
  });
});

