import type { ServerToClientMessage } from "@collaborative-grill/shared";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { WebSocket } from "ws";
import { createApp } from "../src/app.js";
import { createRoomStore, type RoomStore } from "../src/store.js";
import { attachWebSocketServer } from "../src/ws.js";

async function listen(server: HttpServer): Promise<number> {
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

function nextMessage(socket: WebSocket): Promise<ServerToClientMessage> {
  return new Promise((resolve, reject) => {
    const onMessage = (raw: WebSocket.RawData) => {
      socket.off("error", onError);
      resolve(JSON.parse(raw.toString()) as ServerToClientMessage);
    };
    const onError = (err: Error) => {
      socket.off("message", onMessage);
      reject(err);
    };
    socket.once("message", onMessage);
    socket.once("error", onError);
  });
}

describe("WebSocket hub", () => {
  let store: RoomStore;
  let server: HttpServer;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const socket of sockets) {
      socket.close();
    }
    sockets.length = 0;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    store.close();
  });

  async function startServer(): Promise<{ port: number; origin: string }> {
    store = createRoomStore();
    const app = createApp(store);
    server = createServer(app);
    attachWebSocketServer(server, store);
    const port = await listen(server);
    return { port, origin: `http://127.0.0.1:${port}` };
  }

  async function connect(port: number): Promise<WebSocket> {
    const socket = await openSocket(`ws://127.0.0.1:${port}/ws`);
    sockets.push(socket);
    return socket;
  }

  async function subscribe(socket: WebSocket, roomId: string): Promise<void> {
    socket.send(JSON.stringify({ type: "subscribe", roomId }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it("broadcasts Daemon presence to subscribed clients", async () => {
    const { port, origin } = await startServer();
    const created = await request(origin).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id as string;
    const hostCredential = created.body.hostCredential as string;

    const subscriber = await connect(port);
    await subscribe(subscriber, roomId);

    const daemon = await connect(port);
    daemon.send(JSON.stringify({ type: "daemon-connect", roomId, hostCredential }));

    expect(await nextMessage(subscriber)).toEqual({
      type: "presence",
      roomId,
      daemonConnected: true
    });
  });

  it("broadcasts Agent publications as Transcript entries", async () => {
    const { port, origin } = await startServer();
    const created = await request(origin).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id as string;
    const hostCredential = created.body.hostCredential as string;

    const subscriber = await connect(port);
    await subscribe(subscriber, roomId);

    const daemon = await connect(port);
    daemon.send(
      JSON.stringify({
        type: "agent-publication",
        roomId,
        hostCredential,
        body: "the answer"
      })
    );

    const message = await nextMessage(subscriber);
    expect(message.type).toBe("transcript-entry");
    if (message.type === "transcript-entry") {
      expect(message.roomId).toBe(roomId);
      expect(message.entry.kind).toBe("agent");
      expect(message.entry.body).toBe("the answer");
    }
  });

  it("requires the Host credential for Daemon connect and Agent publish", async () => {
    const { port, origin } = await startServer();
    const created = await request(origin).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id as string;
    const hostCredential = created.body.hostCredential as string;

    const subscriber = await connect(port);
    await subscribe(subscriber, roomId);

    const daemon = await connect(port);
    daemon.send(
      JSON.stringify({ type: "daemon-connect", roomId, hostCredential: "wrong-credential" })
    );
    expect(await nextMessage(daemon)).toEqual({
      type: "error",
      message: "Unknown Room or Host credential"
    });

    daemon.send(
      JSON.stringify({
        type: "agent-publication",
        roomId,
        hostCredential: "wrong-credential",
        body: "nope"
      })
    );
    expect(await nextMessage(daemon)).toEqual({
      type: "error",
      message: "Unknown Room or Host credential"
    });

    daemon.send(JSON.stringify({ type: "daemon-connect", roomId, hostCredential }));
    expect(await nextMessage(subscriber)).toEqual({
      type: "presence",
      roomId,
      daemonConnected: true
    });
  });

  it("broadcasts a new Transcript line when a Member posts a Reply over HTTP", async () => {
    const { port, origin } = await startServer();
    const created = await request(origin).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id as string;

    const subscriber = await connect(port);
    await subscribe(subscriber, roomId);

    const pending = nextMessage(subscriber);
    const posted = await request(origin)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "reply", displayName: "Ada", body: "hello room" });
    expect(posted.status).toBe(201);

    const message = await pending;
    expect(message.type).toBe("transcript-entry");
    if (message.type === "transcript-entry") {
      expect(message.roomId).toBe(roomId);
      expect(message.entry.kind).toBe("reply");
      expect(message.entry.body).toBe("hello room");
    }
  });
});
