import type { HostCredential, TranscriptEntry } from "@collaborative-grill/shared";

/** Durable shape for one Room; the persistence port reads and writes this record. */
export interface PersistedRoom {
  id: string;
  topic: string;
  linkToken: string;
  hostCredential: HostCredential;
  daemonConnected: boolean;
  createdAt: string;
  transcript: TranscriptEntry[];
}

/**
 * Injectable persistence for Room metadata and Transcript. Runtime Daemon
 * delivery wiring stays in the Room module, not the store.
 */
export interface RoomPersistence {
  save(room: PersistedRoom): void;
  findById(roomId: string): PersistedRoom | undefined;
  findByLinkToken(linkToken: string): PersistedRoom | undefined;
}

export function createInMemoryRoomPersistence(): RoomPersistence {
  const roomsById = new Map<string, PersistedRoom>();
  const roomIdByLinkToken = new Map<string, string>();

  return {
    save(room: PersistedRoom): void {
      roomsById.set(room.id, room);
      roomIdByLinkToken.set(room.linkToken, room.id);
    },
    findById(roomId: string): PersistedRoom | undefined {
      return roomsById.get(roomId);
    },
    findByLinkToken(linkToken: string): PersistedRoom | undefined {
      const roomId = roomIdByLinkToken.get(linkToken);
      return roomId ? roomsById.get(roomId) : undefined;
    }
  };
}
