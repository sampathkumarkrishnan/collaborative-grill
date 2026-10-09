import { describe, expect, it, vi } from "vitest";
import { RoomSocketClient } from "../src/ws.js";
import { FakeSocket } from "./fakeSocket.js";

describe("RoomSocketClient", () => {
  it("subscribes to the Room once the socket opens", () => {
    const socket = new FakeSocket();
    const client = new RoomSocketClient("ws://example", () => socket);

    client.connect("room-1", { onTranscriptEntry: vi.fn(), onPresence: vi.fn() });
    socket.triggerOpen();

    expect(socket.sent).toEqual([JSON.stringify({ type: "subscribe", roomId: "room-1" })]);
  });

  it("delivers a transcript-entry for this Room to the handler", () => {
    const socket = new FakeSocket();
    const client = new RoomSocketClient("ws://example", () => socket);
    const onTranscriptEntry = vi.fn();

    client.connect("room-1", { onTranscriptEntry, onPresence: vi.fn() });
    const entry = { id: "e1", roomId: "room-1", kind: "reply", body: "hi", createdAt: "now", authorDisplayName: "Ada" };
    socket.triggerMessage(JSON.stringify({ type: "transcript-entry", roomId: "room-1", entry }));

    expect(onTranscriptEntry).toHaveBeenCalledWith(entry);
  });

  it("ignores a transcript-entry broadcast for a different Room", () => {
    const socket = new FakeSocket();
    const client = new RoomSocketClient("ws://example", () => socket);
    const onTranscriptEntry = vi.fn();

    client.connect("room-1", { onTranscriptEntry, onPresence: vi.fn() });
    socket.triggerMessage(
      JSON.stringify({
        type: "transcript-entry",
        roomId: "room-2",
        entry: { id: "e1", roomId: "room-2", kind: "reply", body: "hi", createdAt: "now", authorDisplayName: "Ada" }
      })
    );

    expect(onTranscriptEntry).not.toHaveBeenCalled();
  });

  it("delivers a presence change for this Room to the handler", () => {
    const socket = new FakeSocket();
    const client = new RoomSocketClient("ws://example", () => socket);
    const onPresence = vi.fn();

    client.connect("room-1", { onTranscriptEntry: vi.fn(), onPresence });
    socket.triggerMessage(JSON.stringify({ type: "presence", roomId: "room-1", daemonConnected: true }));

    expect(onPresence).toHaveBeenCalledWith(true);
  });

  it("delivers an error message to the handler", () => {
    const socket = new FakeSocket();
    const client = new RoomSocketClient("ws://example", () => socket);
    const onError = vi.fn();

    client.connect("room-1", { onTranscriptEntry: vi.fn(), onPresence: vi.fn(), onError });
    socket.triggerMessage(JSON.stringify({ type: "error", message: "Malformed message" }));

    expect(onError).toHaveBeenCalledWith("Malformed message");
  });

  it("ignores malformed JSON instead of throwing", () => {
    const socket = new FakeSocket();
    const client = new RoomSocketClient("ws://example", () => socket);

    client.connect("room-1", { onTranscriptEntry: vi.fn(), onPresence: vi.fn() });

    expect(() => socket.triggerMessage("not json")).not.toThrow();
  });

  it("closes the underlying socket on disconnect", () => {
    const socket = new FakeSocket();
    const client = new RoomSocketClient("ws://example", () => socket);

    client.connect("room-1", { onTranscriptEntry: vi.fn(), onPresence: vi.fn() });
    client.disconnect();

    expect(socket.closed).toBe(true);
  });
});
