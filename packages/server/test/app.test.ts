import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createServerRuntime } from "../src/runtime.js";

function httpApp(dbPath?: string) {
  const runtime = createServerRuntime(dbPath);
  return { app: createApp(runtime.room, runtime.hub), runtime };
}

describe("Server HTTP routes", () => {
  it("POST /api/rooms creates a Room and returns a Host credential", async () => {
    const { app, runtime } = httpApp();

    const res = await request(app).post("/api/rooms").send({ topic: "Collaborative grilling" });

    expect(res.status).toBe(201);
    expect(res.body.room.topic).toBe("Collaborative grilling");
    expect(res.body.room.daemonConnected).toBe(false);
    expect(typeof res.body.hostCredential).toBe("string");
    runtime.close();
  });

  it("POST /api/rooms rejects a blank Topic with 400", async () => {
    const { app, runtime } = httpApp();

    const res = await request(app).post("/api/rooms").send({ topic: "   " });

    expect(res.status).toBe(400);
    runtime.close();
  });

  it("GET /api/rooms/by-link/:linkToken joins an existing Room", async () => {
    const { app, runtime } = httpApp();
    const created = await request(app).post("/api/rooms").send({ topic: "Topic A" });
    const linkToken = created.body.room.link.split("/").pop();

    const res = await request(app).get(`/api/rooms/by-link/${linkToken}`);

    expect(res.status).toBe(200);
    expect(res.body.room.id).toBe(created.body.room.id);
    expect(res.body.transcript).toEqual([]);
    runtime.close();
  });

  it("GET /api/rooms/by-link/:linkToken returns 404 and leaks no data for an unknown Link", async () => {
    const { app, runtime } = httpApp();

    const res = await request(app).get("/api/rooms/by-link/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.room).toBeUndefined();
    runtime.close();
  });

  it("POST /api/rooms/:roomId/messages appends a Reply", async () => {
    const { app, runtime } = httpApp();
    const created = await request(app).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id;

    const res = await request(app)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "reply", displayName: "Ada", body: "hello" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.entry.kind).toBe("reply");
    runtime.close();
  });

  it("POST /api/rooms/:roomId/messages rejects a Relay with 403 when not the Host", async () => {
    const { app, runtime } = httpApp();
    const created = await request(app).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id;

    const res = await request(app)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "relay", hostCredential: "wrong", body: "@agent hi" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, error: "not-host" });
    runtime.close();
  });

  it("POST /api/rooms/:roomId/messages rejects a Host Relay with 409 when the Daemon is disconnected", async () => {
    const { app, runtime } = httpApp();
    const created = await request(app).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id as string;
    const hostCredential = created.body.hostCredential as string;

    const res = await request(app)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "relay", hostCredential, body: "@agent hi" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: "daemon-disconnected" });
    runtime.close();
  });

  it("POST /api/rooms/:roomId/messages rejects a Host Relay with 400 when @agent is missing", async () => {
    const { app, runtime } = httpApp();
    const created = await request(app).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id as string;
    const hostCredential = created.body.hostCredential as string;
    runtime.room.daemonConnect(roomId, hostCredential, () => undefined);

    const res = await request(app)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "relay", hostCredential, body: "no marker" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "missing-agent-marker" });
    runtime.close();
  });

  it("persists Room and Transcript across Server restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "collaborative-grill-http-"));
    const dbPath = join(dir, "rooms.sqlite");

    const first = httpApp(dbPath);
    const created = await request(first.app).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id as string;
    const linkToken = created.body.room.link.split("/").pop();

    const posted = await request(first.app)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "reply", displayName: "Ada", body: "hello" });
    expect(posted.status).toBe(201);
    first.runtime.close();

    const restarted = httpApp(dbPath);
    const res = await request(restarted.app).get(`/api/rooms/by-link/${linkToken}`);

    expect(res.status).toBe(200);
    expect(res.body.room.id).toBe(roomId);
    expect(res.body.room.topic).toBe("Topic A");
    expect(res.body.transcript).toHaveLength(1);
    expect(res.body.transcript[0].body).toBe("hello");
    expect(res.body.room.daemonConnected).toBe(false);
    restarted.runtime.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
