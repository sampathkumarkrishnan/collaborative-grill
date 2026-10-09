import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { PersistedRoom, RoomPersistence } from "@collaborative-grill/room";
import type { TranscriptEntry } from "@collaborative-grill/shared";

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

interface RoomRow {
  id: string;
  topic: string;
  link_token: string;
  host_credential: string;
  daemon_connected: number;
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
    daemon_connected INTEGER NOT NULL DEFAULT 0,
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

export interface SqliteRoomPersistence extends RoomPersistence {
  close(): void;
}

function ensureParentDir(dbPath: string): void {
  if (dbPath === ":memory:") {
    return;
  }
  mkdirSync(dirname(dbPath), { recursive: true });
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

function transcriptColumns(entry: TranscriptEntry): {
  authorDisplayName: string | null;
  payload: string | null;
} {
  if (entry.kind === "reply" || entry.kind === "relay") {
    return {
      authorDisplayName: entry.authorDisplayName,
      payload: entry.kind === "relay" ? entry.payload : null
    };
  }
  return { authorDisplayName: null, payload: null };
}

/**
 * SQLite adapter for the Room module persistence port. Daemon presence is
 * reset on open: a Server restart has no live Daemon sockets.
 */
export function createSqliteRoomPersistence(dbPath = ":memory:"): SqliteRoomPersistence {
  ensureParentDir(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  migrateDaemonConnectedColumn(db);
  db.exec("UPDATE rooms SET daemon_connected = 0");
  let closed = false;

  const upsertRoom = db.prepare(
    `INSERT INTO rooms (id, topic, link_token, host_credential, daemon_connected, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       topic = excluded.topic,
       link_token = excluded.link_token,
       host_credential = excluded.host_credential,
       daemon_connected = excluded.daemon_connected,
       created_at = excluded.created_at`
  );
  const selectRoomById = db.prepare(`SELECT * FROM rooms WHERE id = ?`);
  const selectRoomByLink = db.prepare(`SELECT * FROM rooms WHERE link_token = ?`);
  const selectEntries = db.prepare(
    `SELECT id, room_id, kind, body, author_display_name, payload, created_at
     FROM transcript_entries WHERE room_id = ? ORDER BY seq`
  );
  const deleteEntries = db.prepare(`DELETE FROM transcript_entries WHERE room_id = ?`);
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

  function toPersistedRoom(row: RoomRow): PersistedRoom {
    return {
      id: row.id,
      topic: row.topic,
      linkToken: row.link_token,
      hostCredential: row.host_credential,
      daemonConnected: row.daemon_connected === 1,
      createdAt: row.created_at,
      transcript: loadTranscript(row.id)
    };
  }

  return {
    save(room: PersistedRoom): void {
      if (closed) {
        return;
      }
      db.exec("BEGIN");
      try {
        upsertRoom.run(
          room.id,
          room.topic,
          room.linkToken,
          room.hostCredential,
          room.daemonConnected ? 1 : 0,
          room.createdAt
        );
        deleteEntries.run(room.id);
        for (const entry of room.transcript) {
          const columns = transcriptColumns(entry);
          insertEntry.run(
            entry.id,
            entry.roomId,
            entry.kind,
            entry.body,
            columns.authorDisplayName,
            columns.payload,
            entry.createdAt
          );
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    findById(roomId: string): PersistedRoom | undefined {
      if (closed) {
        return undefined;
      }
      const row = selectRoomById.get(roomId) as RoomRow | undefined;
      return row ? toPersistedRoom(row) : undefined;
    },
    findByLinkToken(linkToken: string): PersistedRoom | undefined {
      if (closed) {
        return undefined;
      }
      const row = selectRoomByLink.get(linkToken) as RoomRow | undefined;
      return row ? toPersistedRoom(row) : undefined;
    },
    close(): void {
      if (closed) {
        return;
      }
      closed = true;
      db.close();
    }
  };
}

function migrateDaemonConnectedColumn(db: {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
  exec: (sql: string) => void;
}): void {
  const cols = db.prepare("PRAGMA table_info(rooms)").all() as { name: string }[];
  if (!cols.some((col) => col.name === "daemon_connected")) {
    db.exec("ALTER TABLE rooms ADD COLUMN daemon_connected INTEGER NOT NULL DEFAULT 0");
  }
}
