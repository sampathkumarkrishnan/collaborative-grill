import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createMockRoomStore } from "../src/store.js";

describe("stub Server HTTP routes", () => {
  it("POST /api/rooms creates a Room and returns a Host credential", async () => {
    const app = createApp(createMockRoomStore());

    const res = await request(app).post("/api/rooms").send({ topic: "Collaborative grilling" });

    expect(res.status).toBe(201);
    expect(res.body.room.topic).toBe("Collaborative grilling");
    expect(res.body.room.daemonConnected).toBe(false);
    expect(typeof res.body.hostCredential).toBe("string");
  });

  it("POST /api/rooms rejects a blank Topic with 400", async () => {
    const app = createApp(createMockRoomStore());

    const res = await request(app).post("/api/rooms").send({ topic: "   " });

    expect(res.status).toBe(400);
  });

  it("GET /api/rooms/by-link/:linkToken joins an existing Room", async () => {
    const app = createApp(createMockRoomStore());
    const created = await request(app).post("/api/rooms").send({ topic: "Topic A" });
    const linkToken = created.body.room.link.split("/").pop();

    const res = await request(app).get(`/api/rooms/by-link/${linkToken}`);

    expect(res.status).toBe(200);
    expect(res.body.room.id).toBe(created.body.room.id);
    expect(res.body.transcript).toEqual([]);
  });

  it("GET /api/rooms/by-link/:linkToken returns 404 and leaks no data for an unknown Link", async () => {
    const app = createApp(createMockRoomStore());

    const res = await request(app).get("/api/rooms/by-link/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.room).toBeUndefined();
  });

  it("POST /api/rooms/:roomId/messages appends a Reply", async () => {
    const app = createApp(createMockRoomStore());
    const created = await request(app).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id;

    const res = await request(app)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "reply", displayName: "Ada", body: "hello" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.entry.kind).toBe("reply");
  });

  it("POST /api/rooms/:roomId/messages rejects a Relay with 403 when not the Host", async () => {
    const app = createApp(createMockRoomStore());
    const created = await request(app).post("/api/rooms").send({ topic: "Topic A" });
    const roomId = created.body.room.id;

    const res = await request(app)
      .post(`/api/rooms/${roomId}/messages`)
      .send({ kind: "relay", hostCredential: "wrong", body: "@agent hi" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, error: "not-host" });
  });
});
