import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoomStore, type RoomStore } from "../src/store.js";

describe("createRoomStore", () => {
  let store: RoomStore;

  beforeEach(() => {
    store = createRoomStore();
  });

  afterEach(() => {
    store.close();
  });

  it("creates a Room bound to a minted Link and Host credential, with an empty Transcript", () => {
    const { room, hostCredential } = store.createRoom("Collaborative grilling");

    expect(room.topic).toBe("Collaborative grilling");
    expect(room.daemonConnected).toBe(false);
    expect(typeof room.link).toBe("string");
    expect(room.link.length).toBeGreaterThan(0);
    expect(typeof hostCredential).toBe("string");
    expect(hostCredential.length).toBeGreaterThan(0);

    const found = store.getRoomByLink(room.link.split("/").pop()!);
    expect(found?.transcript).toEqual([]);
  });

  it("looks up a Room by its Link token", () => {
    const { room } = store.createRoom("Topic A");
    const linkToken = room.link.split("/").pop()!;

    expect(store.getRoomByLink(linkToken)?.id).toBe(room.id);
  });

  it("returns undefined for an unknown Link", () => {
    expect(store.getRoomByLink("does-not-exist")).toBeUndefined();
  });

  it("appends a Reply from any Member without touching Daemon state", () => {
    const { room } = store.createRoom("Topic A");

    const result = store.postMessage(room.id, {
      kind: "reply",
      displayName: "Ada",
      body: "hello room"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.kind).toBe("reply");
      expect(result.entry.body).toBe("hello room");
    }
    expect(store.getRoomByLink(room.link.split("/").pop()!)?.transcript).toHaveLength(1);
  });

  it("reports an unknown Room distinctly from a wrong Host credential", () => {
    const result = store.postMessage("no-such-room", {
      kind: "reply",
      displayName: "Ada",
      body: "hello"
    });

    expect(result).toEqual({ ok: false, error: "room-not-found" });
  });

  it("rejects a Relay attempt without the Host credential and does not store it", () => {
    const { room } = store.createRoom("Topic A");

    const result = store.postMessage(room.id, {
      kind: "relay",
      hostCredential: "not-the-real-credential",
      body: "@agent do something"
    });

    expect(result).toEqual({ ok: false, error: "not-host" });
    expect(store.getRoomByLink(room.link.split("/").pop()!)?.transcript).toHaveLength(0);
  });

  it("rejects a Host Relay attempt while the Daemon is disconnected and does not store it", () => {
    const { room, hostCredential } = store.createRoom("Topic A");

    const result = store.postMessage(room.id, {
      kind: "relay",
      hostCredential,
      body: "@agent do something"
    });

    expect(result).toEqual({ ok: false, error: "daemon-disconnected" });
    expect(store.getRoomByLink(room.link.split("/").pop()!)?.transcript).toHaveLength(0);
  });

  it("accepts a Host Relay once the Daemon is connected, storing the trimmed payload", () => {
    const { room, hostCredential } = store.createRoom("Topic A");
    store.setDaemonConnected(room.id, hostCredential, true);

    const result = store.postMessage(room.id, {
      kind: "relay",
      hostCredential,
      body: "@agent   do something   "
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.entry.kind === "relay") {
      expect(result.entry.payload).toBe("do something");
    }
  });

  it("rejects a Relay missing the @agent marker and does not store it", () => {
    const { room, hostCredential } = store.createRoom("Topic A");
    store.setDaemonConnected(room.id, hostCredential, true);

    const result = store.postMessage(room.id, {
      kind: "relay",
      hostCredential,
      body: "no marker here"
    });

    expect(result).toEqual({ ok: false, error: "missing-agent-marker" });
  });

  it("appends an Agent publication only from the matching Host credential", () => {
    const { room, hostCredential } = store.createRoom("Topic A");

    const ok = store.publishAgentEntry(room.id, hostCredential, "the answer");
    expect(ok).toBe(true);

    const rejected = store.publishAgentEntry(room.id, "wrong-credential", "nope");
    expect(rejected).toBe(false);

    const transcript = store.getRoomByLink(room.link.split("/").pop()!)?.transcript ?? [];
    expect(transcript).toHaveLength(1);
    expect(transcript[0]?.kind).toBe("agent");
  });

  it("persists Room and Transcript across a Server restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "collaborative-grill-"));
    const dbPath = join(dir, "rooms.sqlite");

    const first = createRoomStore(dbPath);
    const { room, hostCredential } = first.createRoom("Collaborative grilling");
    const reply = first.postMessage(room.id, {
      kind: "reply",
      displayName: "Ada",
      body: "hello room"
    });
    expect(reply.ok).toBe(true);
    first.close();

    const restarted = createRoomStore(dbPath);
    const linkToken = room.link.split("/").pop()!;
    const restored = restarted.getRoomByLink(linkToken);

    expect(restored?.id).toBe(room.id);
    expect(restored?.topic).toBe("Collaborative grilling");
    expect(restored?.transcript).toHaveLength(1);
    expect(restored?.transcript[0]?.kind).toBe("reply");
    expect(restored?.transcript[0]?.body).toBe("hello room");
    expect(restored?.daemonConnected).toBe(false);
    expect(restarted.setDaemonConnected(room.id, hostCredential, true)).toBe(true);

    restarted.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
