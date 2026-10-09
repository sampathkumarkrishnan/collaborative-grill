import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRoomModule,
  DaemonTestClient,
  MemberTestClient,
  type RoomModule
} from "@collaborative-grill/room";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteRoomPersistence, type SqliteRoomPersistence } from "../src/sqlite.js";

describe("Room spec against Server SQLite persistence", () => {
  let persistence: SqliteRoomPersistence;
  let roomModule: RoomModule;
  let host: MemberTestClient;
  let member: MemberTestClient;
  let daemon: DaemonTestClient;

  beforeEach(() => {
    persistence = createSqliteRoomPersistence();
    roomModule = createRoomModule({ persistence });
    host = new MemberTestClient(roomModule);
    member = new MemberTestClient(roomModule);
    daemon = new DaemonTestClient(roomModule);
  });

  afterEach(() => {
    persistence.close();
  });

  it("create binds Host, stores Topic, mints Link, and does not add Agent lines", () => {
    const { room, hostCredential, linkToken } = host.createRoom("Grill the ADR");

    expect(room.topic).toBe("Grill the ADR");
    expect(room.daemonConnected).toBe(false);
    expect(linkToken.length).toBeGreaterThan(0);
    expect(hostCredential.length).toBeGreaterThan(0);
    expect(room.link).toBe(`/r/${linkToken}`);
    expect(host.getTranscript()).toEqual([]);
  });

  it("join by Link admits a Member; an invalid Link does not leak data", () => {
    const { linkToken } = host.createRoom("Topic A");
    host.postReply("Host", "welcome");

    const joined = member.joinByLink(linkToken);
    expect(joined).not.toBeNull();
    expect(joined!.room.id).toBe(host.activeRoomId);
    expect(joined!.transcript).toHaveLength(1);

    const stranger = new MemberTestClient(createRoomModule({ persistence }));
    expect(stranger.joinByLink("bogus-link-token")).toBeNull();
    expect(stranger.getTranscript()).toEqual([]);
  });

  it("appends Replies while the Daemon is disconnected and does not deliver to the Daemon", () => {
    host.createRoom("Topic A");
    daemon.connect(host.activeRoomId!, "wrong-credential");

    const result = host.postReply("Ada", "side talk");
    expect(result.ok).toBe(true);

    expect(host.getTranscript()).toHaveLength(1);
    expect(daemon.deliveries).toHaveLength(0);
  });

  it("rejects non-Host Relay attempts without changing the Transcript", () => {
    const { linkToken } = host.createRoom("Topic A");
    member.joinByLink(linkToken);

    const result = member.postRelayAttempt("@agent hack the agent");
    expect(result).toEqual({ ok: false, error: "not-host" });
    expect(host.getTranscript()).toHaveLength(0);
  });

  it("rejects Host Relay while Daemon disconnected with daemon-disconnected", () => {
    host.createRoom("Topic A");

    const result = host.postRelayAsHost("@agent do work");
    expect(result).toEqual({ ok: false, error: "daemon-disconnected" });
    expect(host.getTranscript()).toHaveLength(0);
  });

  it("accepts Relay, delivers once to the Daemon with trimmed payload, and Agent publication appends one line", () => {
    host.createRoom("Topic A");
    const roomId = host.activeRoomId!;
    const cred = host.getHostCredential()!;
    daemon.connect(roomId, cred);

    const relay = host.postRelayAsHost("@agent   summarize   ");
    expect(relay.ok).toBe(true);
    if (relay.ok && relay.entry.kind === "relay") {
      expect(relay.entry.payload).toBe("summarize");
    }

    expect(daemon.deliveries).toEqual([
      {
        roomId,
        relayId: relay.ok ? relay.entry.id : "",
        payload: "summarize"
      }
    ]);

    const published = daemon.publishAgent(roomId, cred, "here is the summary");
    expect(published.ok).toBe(true);
    expect(host.getTranscript().map((entry) => entry.kind)).toEqual(["relay", "agent"]);
  });

  it("does not deliver a Relay for one Room to another Room's Daemon path", () => {
    host.createRoom("Room A");
    const hostB = new MemberTestClient(roomModule);
    hostB.createRoom("Room B");

    const daemonA = new DaemonTestClient(roomModule);
    const daemonB = new DaemonTestClient(roomModule);

    daemonA.connect(host.activeRoomId!, host.getHostCredential()!);
    daemonB.connect(hostB.activeRoomId!, hostB.getHostCredential()!);

    host.postRelayAsHost("@agent for room A");

    expect(daemonA.deliveries).toHaveLength(1);
    expect(daemonB.deliveries).toHaveLength(0);
  });

  it("rejects Agent publication and Daemon connect without the Host credential", () => {
    host.createRoom("Topic A");
    const roomId = host.activeRoomId!;

    expect(daemon.connect(roomId, "not-the-host")).toBe(false);
    expect(daemon.publishAgent(roomId, "not-the-host", "sneaky answer")).toEqual({ ok: false });
    expect(host.getTranscript()).toHaveLength(0);
    expect(daemon.deliveries).toHaveLength(0);
  });

  it("keeps Reply, Relay, and Agent lines in one Transcript order", () => {
    host.createRoom("Topic A");
    const roomId = host.activeRoomId!;
    const cred = host.getHostCredential()!;
    daemon.connect(roomId, cred);

    host.postReply("Ada", "question");
    host.postRelayAsHost("@agent answer Ada");
    daemon.publishAgent(roomId, cred, "answer text");

    expect(host.getTranscript().map((entry) => entry.kind)).toEqual(["reply", "relay", "agent"]);
  });

  it("persists Room and Transcript across a new Room module on the same SQLite file", () => {
    const dir = mkdtempSync(join(tmpdir(), "collaborative-grill-room-"));
    const dbPath = join(dir, "rooms.sqlite");

    const firstPersistence = createSqliteRoomPersistence(dbPath);
    const first = createRoomModule({ persistence: firstPersistence });
    const firstHost = new MemberTestClient(first);
    const created = firstHost.createRoom("Collaborative grilling");
    firstHost.postReply("Ada", "hello room");
    firstPersistence.close();

    const restartedPersistence = createSqliteRoomPersistence(dbPath);
    const restarted = createRoomModule({ persistence: restartedPersistence });
    const joined = restarted.joinByLink(created.linkToken);

    expect(joined?.room.id).toBe(created.room.id);
    expect(joined?.room.topic).toBe("Collaborative grilling");
    expect(joined?.room.daemonConnected).toBe(false);
    expect(joined?.transcript).toHaveLength(1);
    expect(joined?.transcript[0]?.body).toBe("hello room");

    restartedPersistence.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
