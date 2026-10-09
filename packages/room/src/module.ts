import { randomUUID } from "node:crypto";
import {
  parseRelayCandidate,
  type HostCredential,
  type PostMessageRequest,
  type PostMessageResponse,
  type RoomSummary,
  type TranscriptEntry
} from "@collaborative-grill/shared";
import {
  createInMemoryRoomPersistence,
  type PersistedRoom,
  type RoomPersistence
} from "./persistence.js";

export interface RelayDelivery {
  roomId: string;
  relayId: string;
  payload: string;
}

export interface CreateRoomResult {
  room: RoomSummary;
  hostCredential: HostCredential;
  linkToken: string;
}

export interface JoinByLinkResult {
  room: RoomSummary;
  transcript: TranscriptEntry[];
}

export type PublishAgentResult = { ok: true; entry: TranscriptEntry } | { ok: false };

export interface RoomModule {
  createRoom(topic: string): CreateRoomResult;
  joinByLink(linkToken: string): JoinByLinkResult | null;
  postMessage(roomId: string, request: PostMessageRequest): PostMessageResponse;
  daemonConnect(
    roomId: string,
    hostCredential: HostCredential,
    onDelivery: (delivery: RelayDelivery) => void
  ): boolean;
  daemonDisconnect(roomId: string, hostCredential: HostCredential): boolean;
  publishAgentMessage(
    roomId: string,
    hostCredential: HostCredential,
    body: string
  ): PublishAgentResult;
  getTranscript(roomId: string): TranscriptEntry[];
  getRoomSummary(roomId: string): RoomSummary | undefined;
}

interface DaemonSlot {
  hostCredential: HostCredential;
  onDelivery: (delivery: RelayDelivery) => void;
}

function toSummary(room: PersistedRoom): RoomSummary {
  return {
    id: room.id,
    topic: room.topic,
    link: `/r/${room.linkToken}`,
    daemonConnected: room.daemonConnected,
    createdAt: room.createdAt
  };
}

export interface CreateRoomModuleOptions {
  persistence?: RoomPersistence;
}

export function createRoomModule(options: CreateRoomModuleOptions = {}): RoomModule {
  const persistence = options.persistence ?? createInMemoryRoomPersistence();
  const daemonByRoomId = new Map<string, DaemonSlot>();

  function getRoom(roomId: string): PersistedRoom | undefined {
    return persistence.findById(roomId);
  }

  function persistRoom(room: PersistedRoom): void {
    persistence.save(room);
  }

  function deliverRelay(room: PersistedRoom, relayId: string, payload: string): void {
    const slot = daemonByRoomId.get(room.id);
    if (!slot || slot.hostCredential !== room.hostCredential) {
      return;
    }
    slot.onDelivery({ roomId: room.id, relayId, payload });
  }

  return {
    createRoom(topic: string): CreateRoomResult {
      const room: PersistedRoom = {
        id: randomUUID(),
        topic,
        linkToken: randomUUID(),
        hostCredential: randomUUID(),
        daemonConnected: false,
        createdAt: new Date().toISOString(),
        transcript: []
      };
      persistRoom(room);
      return {
        room: toSummary(room),
        hostCredential: room.hostCredential,
        linkToken: room.linkToken
      };
    },

    joinByLink(linkToken: string): JoinByLinkResult | null {
      const room = persistence.findByLinkToken(linkToken);
      if (!room) {
        return null;
      }
      return { room: toSummary(room), transcript: [...room.transcript] };
    },

    postMessage(roomId: string, request: PostMessageRequest): PostMessageResponse {
      const room = getRoom(roomId);
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
        room.transcript.push(entry);
        persistRoom(room);
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
      room.transcript.push(entry);
      persistRoom(room);
      deliverRelay(room, entry.id, candidate.payload);
      return { ok: true, entry };
    },

    daemonConnect(
      roomId: string,
      hostCredential: HostCredential,
      onDelivery: (delivery: RelayDelivery) => void
    ): boolean {
      const room = getRoom(roomId);
      if (!room || room.hostCredential !== hostCredential) {
        return false;
      }
      room.daemonConnected = true;
      persistRoom(room);
      daemonByRoomId.set(roomId, { hostCredential, onDelivery });
      return true;
    },

    daemonDisconnect(roomId: string, hostCredential: HostCredential): boolean {
      const room = getRoom(roomId);
      if (!room || room.hostCredential !== hostCredential) {
        return false;
      }
      room.daemonConnected = false;
      persistRoom(room);
      daemonByRoomId.delete(roomId);
      return true;
    },

    publishAgentMessage(
      roomId: string,
      hostCredential: HostCredential,
      body: string
    ): PublishAgentResult {
      const room = getRoom(roomId);
      if (!room || room.hostCredential !== hostCredential) {
        return { ok: false };
      }

      const entry: TranscriptEntry = {
        kind: "agent",
        id: randomUUID(),
        roomId,
        body,
        createdAt: new Date().toISOString()
      };
      room.transcript.push(entry);
      persistRoom(room);
      return { ok: true, entry };
    },

    getTranscript(roomId: string): TranscriptEntry[] {
      const room = getRoom(roomId);
      return room ? [...room.transcript] : [];
    },

    getRoomSummary(roomId: string): RoomSummary | undefined {
      const room = getRoom(roomId);
      return room ? toSummary(room) : undefined;
    }
  };
}
