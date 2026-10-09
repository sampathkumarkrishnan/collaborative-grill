import { randomUUID } from "node:crypto";
import {
  parseRelayCandidate,
  type HostCredential,
  type PostMessageRequest,
  type PostMessageResponse,
  type RoomSummary,
  type TranscriptEntry
} from "@collaborative-grill/shared";

/**
 * This store is a mock for local development only. It is intentionally
 * naive (no persistence, no multi-process fan-out, minimal rejection
 * rules) and must not be mistaken for the Room module's authority, which
 * ships in a later ticket. It exists so the web app and Daemon can be
 * built against real wire shapes before the Room module lands.
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

export interface MockRoomStore {
  createRoom(topic: string): { room: RoomSummary; hostCredential: HostCredential };
  getRoomByLink(linkToken: string): RoomRecord | undefined;
  getRoomById(roomId: string): RoomRecord | undefined;
  /** The public `RoomSummary` shape for a Room record, shared by every HTTP route. */
  toSummary(room: RoomRecord): RoomSummary;
  setDaemonConnected(roomId: string, hostCredential: HostCredential, connected: boolean): boolean;
  postMessage(roomId: string, request: PostMessageRequest): PostMessageResponse;
  publishAgentEntry(roomId: string, hostCredential: HostCredential, body: string): boolean;
}

function toSummary(room: RoomRecord): RoomSummary {
  return {
    id: room.id,
    topic: room.topic,
    link: `/r/${room.linkToken}`,
    daemonConnected: room.daemonConnected,
    createdAt: room.createdAt
  };
}

export function createMockRoomStore(): MockRoomStore {
  const roomsById = new Map<string, RoomRecord>();
  const roomIdByLinkToken = new Map<string, string>();

  function getRoomById(roomId: string): RoomRecord | undefined {
    return roomsById.get(roomId);
  }

  function getRoomByLink(linkToken: string): RoomRecord | undefined {
    const roomId = roomIdByLinkToken.get(linkToken);
    return roomId ? roomsById.get(roomId) : undefined;
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

    roomsById.set(room.id, room);
    roomIdByLinkToken.set(room.linkToken, room.id);

    return { room: toSummary(room), hostCredential: room.hostCredential };
  }

  function setDaemonConnected(
    roomId: string,
    hostCredential: HostCredential,
    connected: boolean
  ): boolean {
    const room = roomsById.get(roomId);
    if (!room || room.hostCredential !== hostCredential) {
      return false;
    }
    room.daemonConnected = connected;
    return true;
  }

  function postMessage(roomId: string, request: PostMessageRequest): PostMessageResponse {
    const room = roomsById.get(roomId);
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
    return { ok: true, entry };
  }

  function publishAgentEntry(
    roomId: string,
    hostCredential: HostCredential,
    body: string
  ): boolean {
    const room = roomsById.get(roomId);
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
    room.transcript.push(entry);
    return true;
  }

  return {
    createRoom,
    getRoomByLink,
    getRoomById,
    toSummary,
    setDaemonConnected,
    postMessage,
    publishAgentEntry
  };
}
