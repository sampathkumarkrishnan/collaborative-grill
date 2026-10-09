import { createRoomModule, type RoomModule } from "@collaborative-grill/room";
import { createBroadcastHub, type BroadcastHub } from "./hub.js";
import { createSqliteRoomPersistence, type SqliteRoomPersistence } from "./sqlite.js";

export interface ServerRuntime {
  room: RoomModule;
  hub: BroadcastHub;
  close(): void;
}

export function createServerRuntime(dbPath = ":memory:"): ServerRuntime {
  const persistence: SqliteRoomPersistence = createSqliteRoomPersistence(dbPath);
  const room = createRoomModule({ persistence });
  const hub = createBroadcastHub();
  return {
    room,
    hub,
    close() {
      persistence.close();
    }
  };
}
