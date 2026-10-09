import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { ApiClient, RoomNotFoundError } from "../src/api.js";
import { server } from "./msw/server.js";

const BASE_URL = "https://server.test";

describe("ApiClient", () => {
  it("creates a Room and returns the Host credential", async () => {
    server.use(
      http.post(`${BASE_URL}/api/rooms`, async ({ request }) => {
        const body = (await request.json()) as { topic: string };
        return HttpResponse.json(
          {
            room: {
              id: "room-1",
              topic: body.topic,
              link: "/r/abc123",
              daemonConnected: false,
              createdAt: "2026-01-01T00:00:00.000Z"
            },
            hostCredential: "secret-token"
          },
          { status: 201 }
        );
      })
    );

    const client = new ApiClient({ baseUrl: BASE_URL });
    const response = await client.createRoom("Collaborative grilling");

    expect(response.room.topic).toBe("Collaborative grilling");
    expect(response.hostCredential).toBe("secret-token");
  });

  it("throws with the Server's error message when creating a Room fails", async () => {
    server.use(
      http.post(`${BASE_URL}/api/rooms`, () => HttpResponse.json({ error: "topic is required" }, { status: 400 }))
    );

    const client = new ApiClient({ baseUrl: BASE_URL });

    await expect(client.createRoom("")).rejects.toThrow("topic is required");
  });

  it("joins a Room by Link", async () => {
    server.use(
      http.get(`${BASE_URL}/api/rooms/by-link/abc123`, () =>
        HttpResponse.json({
          room: {
            id: "room-1",
            topic: "Collaborative grilling",
            link: "/r/abc123",
            daemonConnected: true,
            createdAt: "2026-01-01T00:00:00.000Z"
          },
          transcript: []
        })
      )
    );

    const client = new ApiClient({ baseUrl: BASE_URL });
    const response = await client.joinByLink("/r/abc123");

    expect(response.room.id).toBe("room-1");
    expect(response.transcript).toEqual([]);
  });

  it("throws RoomNotFoundError for an unknown Link and leaks no Room data", async () => {
    server.use(
      http.get(`${BASE_URL}/api/rooms/by-link/does-not-exist`, () =>
        HttpResponse.json({ error: "not-found" }, { status: 404 })
      )
    );

    const client = new ApiClient({ baseUrl: BASE_URL });

    await expect(client.joinByLink("/r/does-not-exist")).rejects.toBeInstanceOf(RoomNotFoundError);
  });

  it("posts a Reply message", async () => {
    server.use(
      http.post(`${BASE_URL}/api/rooms/room-1/messages`, async ({ request }) => {
        const body = (await request.json()) as { kind: string; body: string; displayName: string };
        return HttpResponse.json(
          {
            ok: true,
            entry: {
              id: "entry-1",
              roomId: "room-1",
              kind: "reply",
              body: body.body,
              authorDisplayName: body.displayName,
              createdAt: "2026-01-01T00:00:00.000Z"
            }
          },
          { status: 201 }
        );
      })
    );

    const client = new ApiClient({ baseUrl: BASE_URL });
    const response = await client.postMessage("room-1", {
      kind: "reply",
      displayName: "Ada",
      body: "hello"
    });

    expect(response).toEqual({
      ok: true,
      entry: {
        id: "entry-1",
        roomId: "room-1",
        kind: "reply",
        body: "hello",
        authorDisplayName: "Ada",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    });
  });

  it("surfaces a non-Host Relay rejection (not-host) as an ok:false body", async () => {
    server.use(
      http.post(`${BASE_URL}/api/rooms/room-1/messages`, () =>
        HttpResponse.json({ ok: false, error: "not-host" }, { status: 403 })
      )
    );

    const client = new ApiClient({ baseUrl: BASE_URL });
    const response = await client.postMessage("room-1", {
      kind: "relay",
      hostCredential: "wrong-credential",
      body: "@agent hi"
    });

    expect(response).toEqual({ ok: false, error: "not-host" });
  });

  it("surfaces a rejected Relay as an ok:false body rather than throwing", async () => {
    server.use(
      http.post(`${BASE_URL}/api/rooms/room-1/messages`, () =>
        HttpResponse.json({ ok: false, error: "daemon-disconnected" }, { status: 409 })
      )
    );

    const client = new ApiClient({ baseUrl: BASE_URL });
    const response = await client.postMessage("room-1", {
      kind: "relay",
      hostCredential: "secret-token",
      body: "@agent hi"
    });

    expect(response).toEqual({ ok: false, error: "daemon-disconnected" });
  });
});
