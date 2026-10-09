import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    };
    close(): void;
  };
};
import {
  parseRelayCandidate,
  type HostCredential,
  type PostMessageRequest,
  type PostMessageResponse,
  type RoomSummary,
  type TranscriptEntry
} from "@collaborative-grill/shared";

/**
 * Room module API used by HTTP and WebSocket. This is a stub of the Room
 * module (ticket 1) so the Server can persist and serve against the shared
 * contract now, then swap in the real Room module without changing the wire.
 */
export interface RoomRecord {
  id: string;
  topic: string;
  linkToken: string;
  hostCredential: HostCredential;
  daemonConnected: boolean;
  createdAt: string;
  transcript: TranscriptEntry[];
}

export type TranscriptListener = (roomId: string, entry: TranscriptEntry) => void;
export type PresenceListener = (roomId: string, daemonConnected: boolean) => void;

export interface RoomStore {
  createRoom(topic: string): { room: RoomSummary; hostCredential: HostCredential };
  getRoomByLink(linkToken: string): RoomRecord | undefined;
  getRoomById(roomId: string): RoomRecord | undefined;
  /** The public `RoomSummary` shape for a Room record, shared by every HTTP route. */
  toSummary(room: RoomRecord): RoomSummary;
  setDaemonConnected(roomId: string, hostCredential: HostCredential, connected: boolean): boolean;
  postMessage(roomId: string, request: PostMessageRequest): PostMessageResponse;
  publishAgentEntry(roomId: string, hostCredential: HostCredential, body: string): boolean;
  addTranscriptListener(listener: TranscriptListener): void;
  addPresenceListener(listener: PresenceListener): void;
  close(): void;
}

interface RoomRow {
  id: string;
  topic: string;
  link_token: string;
  host_credential: string;
  created_at: string;
}

interface TranscriptEntryRow {
  id: string;
  room_id: string;
  kind: string;
  body: string;
  author_display_name: string | null;
  payload: string | null;
  created_at: string;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    link_token TEXT NOT NULL UNIQUE,
    host_credential TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS transcript_entries (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    room_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    author_display_name TEXT,
    payload TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  ) STRICT;
`;

function toSummary(room: RoomRecord): RoomSummary {
  return {
    id: room.id,
    topic: room.topic,
    link: `/r/${room.linkToken}`,
    daemonConnected: room.daemonConnected,
    createdAt: room.createdAt
  };
}

function toTranscriptEntry(row: TranscriptEntryRow): TranscriptEntry | undefined {
  if (row.kind === "reply") {
    return {
      kind: "reply",
      id: row.id,
      roomId: row.room_id,
      body: row.body,
      authorDisplayName: row.author_display_name ?? "",
      createdAt: row.created_at
    };
  }

  if (row.kind === "relay") {
    return {
      kind: "relay",
      id: row.id,
      roomId: row.room_id,
      body: row.body,
      authorDisplayName: row.author_display_name ?? "Host",
      payload: row.payload ?? "",
      createdAt: row.created_at
    };
  }

  if (row.kind === "agent") {
    return {
      kind: "agent",
      id: row.id,
      roomId: row.room_id,
      body: row.body,
      createdAt: row.created_at
    };
  }

  return undefined;
}

function ensureParentDir(dbPath: string): void {
  if (dbPath === ":memory:") {
    return;
  }
  mkdirSync(dirname(dbPath), { recursive: true });
}

/**
 * SQLite persistence adapter plus Room stub. Daemon presence is connection
 * state and is not persisted: a Server restart has no live Daemon sockets.
 */
export function createRoomStore(dbPath = ":memory:"): RoomStore {
  ensureParentDir(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);

  const daemonConnectedByRoomId = new Map<string, boolean>();
  const transcriptListeners: TranscriptListener[] = [];
  const presenceListeners: PresenceListener[] = [];

  function notifyTranscript(roomId: string, entry: TranscriptEntry): void {
    for (const listener of transcriptListeners) {
      listener(roomId, entry);
    }
  }

  function notifyPresence(roomId: string, daemonConnected: boolean): void {
    for (const listener of presenceListeners) {
      listener(roomId, daemonConnected);
    }
  }

  const insertRoom = db.prepare(
    `INSERT INTO rooms (id, topic, link_token, host_credential, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const selectRoomById = db.prepare(`SELECT * FROM rooms WHERE id = ?`);
  const selectRoomByLink = db.prepare(`SELECT * FROM rooms WHERE link_token = ?`);
  const selectEntries = db.prepare(
    `SELECT id, room_id, kind, body, author_display_name, payload, created_at
     FROM transcript_entries WHERE room_id = ? ORDER BY seq`
  );
  const insertEntry = db.prepare(
    `INSERT INTO transcript_entries
     (id, room_id, kind, body, author_display_name, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  function loadTranscript(roomId: string): TranscriptEntry[] {
    return (selectEntries.all(roomId) as TranscriptEntryRow[])
      .map(toTranscriptEntry)
      .filter((entry): entry is TranscriptEntry => entry !== undefined);
  }

  function toRoomRecord(row: RoomRow): RoomRecord {
    return {
      id: row.id,
      topic: row.topic,
      linkToken: row.link_token,
      hostCredential: row.host_credential,
      daemonConnected: daemonConnectedByRoomId.get(row.id) ?? false,
      createdAt: row.created_at,
      transcript: loadTranscript(row.id)
    };
  }

  function getRoomById(roomId: string): RoomRecord | undefined {
    const row = selectRoomById.get(roomId) as RoomRow | undefined;
    return row ? toRoomRecord(row) : undefined;
  }

  function getRoomByLink(linkToken: string): RoomRecord | undefined {
    const row = selectRoomByLink.get(linkToken) as RoomRow | undefined;
    return row ? toRoomRecord(row) : undefined;
  }

  function appendEntry(entry: TranscriptEntry): void {
    const authorDisplayName =
      entry.kind === "reply" || entry.kind === "relay" ? entry.authorDisplayName : null;
    const payload = entry.kind === "relay" ? entry.payload : null;
    insertEntry.run(
      entry.id,
      entry.roomId,
      entry.kind,
      entry.body,
      authorDisplayName,
      payload,
      entry.createdAt
    );
    notifyTranscript(entry.roomId, entry);
  }

  function createRoom(topic: string): { room: RoomSummary; hostCredential: HostCredential } {
    const room: RoomRecord = {
      id: randomUUID(),
      topic,
      linkToken: randomUUID(),
      hostCredential: randomUUID(),
      daemonConnected: false,
      createdAt: new Date().toISOString(),
      transcript: []
    };

    insertRoom.run(room.id, room.topic, room.linkToken, room.hostCredential, room.createdAt);
    return { room: toSummary(room), hostCredential: room.hostCredential };
  }

  function setDaemonConnected(
    roomId: string,
    hostCredential: HostCredential,
    connected: boolean
  ): boolean {
    const room = getRoomById(roomId);
    if (!room || room.hostCredential !== hostCredential) {
      return false;
    }
    daemonConnectedByRoomId.set(roomId, connected);
    notifyPresence(roomId, connected);
    return true;
  }

  function postMessage(roomId: string, request: PostMessageRequest): PostMessageResponse {
    const room = getRoomById(roomId);
    if (!room) {
      return { ok: false, error: "room-not-found" };
    }

    if (request.kind === "reply") {
      const entry: TranscriptEntry = {
        kind: "reply",
        id: randomUUID(),
        roomId,
        body: request.body,
        authorDisplayName: request.displayName,
        createdAt: new Date().toISOString()
      };
      appendEntry(entry);
      return { ok: true, entry };
    }

    if (request.hostCredential !== room.hostCredential) {
      return { ok: false, error: "not-host" };
    }

    if (!room.daemonConnected) {
      return { ok: false, error: "daemon-disconnected" };
    }

    const candidate = parseRelayCandidate(request.body);
    if (!candidate.isRelay || candidate.payload === null) {
      return { ok: false, error: "missing-agent-marker" };
    }

    const entry: TranscriptEntry = {
      kind: "relay",
      id: randomUUID(),
      roomId,
      body: request.body,
      authorDisplayName: "Host",
      payload: candidate.payload,
      createdAt: new Date().toISOString()
    };
    appendEntry(entry);
    return { ok: true, entry };
  }

  function publishAgentEntry(
    roomId: string,
    hostCredential: HostCredential,
    body: string
  ): boolean {
    const room = getRoomById(roomId);
    if (!room || room.hostCredential !== hostCredential) {
      return false;
    }

    const entry: TranscriptEntry = {
      kind: "agent",
      id: randomUUID(),
      roomId,
      body,
      createdAt: new Date().toISOString()
    };
    appendEntry(entry);
    return true;
  }

  function addTranscriptListener(listener: TranscriptListener): void {
    transcriptListeners.push(listener);
  }

  function addPresenceListener(listener: PresenceListener): void {
    presenceListeners.push(listener);
  }

  function close(): void {
    db.close();
  }

  return {
    createRoom,
    getRoomByLink,
    getRoomById,
    toSummary,
    setDaemonConnected,
    postMessage,
    publishAgentEntry,
    addTranscriptListener,
    addPresenceListener,
    close
  };
}
