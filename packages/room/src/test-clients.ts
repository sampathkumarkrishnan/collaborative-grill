import type {
  HostCredential,
  PostMessageResponse,
  RoomSummary,
  TranscriptEntry
} from "@collaborative-grill/shared";
import type { CreateRoomResult, JoinByLinkResult, RelayDelivery, RoomModule } from "./module.js";

/**
 * Member-side test harness: create, join by Link, Replies, and Relay attempts.
 * Does not depend on HTTP, WebSocket, or UI.
 */
export class MemberTestClient {
  private roomId: string | undefined;
  private hostCredential: HostCredential | undefined;
  private linkToken: string | undefined;

  constructor(private readonly room: RoomModule) {}

  createRoom(topic: string): CreateRoomResult {
    const result = this.room.createRoom(topic);
    this.roomId = result.room.id;
    this.hostCredential = result.hostCredential;
    this.linkToken = result.linkToken;
    return result;
  }

  joinByLink(linkToken: string): JoinByLinkResult | null {
    const joined = this.room.joinByLink(linkToken);
    if (!joined) {
      return null;
    }
    this.roomId = joined.room.id;
    this.hostCredential = undefined;
    this.linkToken = linkToken;
    return joined;
  }

  get activeRoomId(): string | undefined {
    return this.roomId;
  }

  get isHost(): boolean {
    return this.hostCredential !== undefined;
  }

  postReply(displayName: string, body: string): PostMessageResponse {
    if (!this.roomId) {
      return { ok: false, error: "room-not-found" };
    }
    return this.room.postMessage(this.roomId, {
      kind: "reply",
      displayName,
      body
    });
  }

  /** Host Relay when this client created the Room; otherwise a non-Host attempt. */
  postRelayAttempt(body: string): PostMessageResponse {
    if (!this.roomId) {
      return { ok: false, error: "room-not-found" };
    }
    const credential = this.hostCredential ?? "not-a-host-credential";
    return this.room.postMessage(this.roomId, {
      kind: "relay",
      hostCredential: credential,
      body
    });
  }

  postRelayAsHost(body: string): PostMessageResponse {
    if (!this.roomId || !this.hostCredential) {
      return { ok: false, error: "not-host" };
    }
    return this.room.postMessage(this.roomId, {
      kind: "relay",
      hostCredential: this.hostCredential,
      body
    });
  }

  getTranscript(): TranscriptEntry[] {
    if (!this.roomId) {
      return [];
    }
    return this.room.getTranscript(this.roomId);
  }

  getRoomSummary(): RoomSummary | undefined {
    if (!this.roomId) {
      return undefined;
    }
    return this.room.getRoomSummary(this.roomId);
  }

  getHostCredential(): HostCredential | undefined {
    return this.hostCredential;
  }

  getLinkToken(): string | undefined {
    return this.linkToken;
  }
}

/**
 * Daemon-side test harness: connect/disconnect, record Relay deliveries,
 * publish Agent lines.
 */
export class DaemonTestClient {
  readonly deliveries: RelayDelivery[] = [];
  private connectedRoomId: string | undefined;

  constructor(private readonly room: RoomModule) {}

  connect(roomId: string, hostCredential: HostCredential): boolean {
    const ok = this.room.daemonConnect(roomId, hostCredential, (delivery) => {
      this.deliveries.push(delivery);
    });
    if (ok) {
      this.connectedRoomId = roomId;
    }
    return ok;
  }

  disconnect(roomId: string, hostCredential: HostCredential): boolean {
    const ok = this.room.daemonDisconnect(roomId, hostCredential);
    if (ok && this.connectedRoomId === roomId) {
      this.connectedRoomId = undefined;
    }
    return ok;
  }

  publishAgent(roomId: string, hostCredential: HostCredential, body: string) {
    return this.room.publishAgentMessage(roomId, hostCredential, body);
  }

  isConnectedTo(roomId: string): boolean {
    return this.connectedRoomId === roomId;
  }
}
