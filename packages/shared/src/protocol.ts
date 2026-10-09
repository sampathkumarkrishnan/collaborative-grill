import type { HostCredential, RoomSummary } from "./room.js";
import type { TranscriptEntry } from "./transcript.js";

/* ---------------------------------------------------------------------- */
/* HTTP contract                                                          */
/* ---------------------------------------------------------------------- */

/** `POST /api/rooms` request body. */
export interface CreateRoomRequest {
  topic: string;
}

/** `POST /api/rooms` response body. The Host credential is minted once, here. */
export interface CreateRoomResponse {
  room: RoomSummary;
  hostCredential: HostCredential;
}

/** `GET /api/rooms/by-link/:linkToken` response body. */
export interface JoinRoomResponse {
  room: RoomSummary;
  transcript: TranscriptEntry[];
}

/** `GET /api/rooms/:roomId/transcript` response body. */
export interface GetTranscriptResponse {
  transcript: TranscriptEntry[];
}

/** A Reply attempt: `POST /api/rooms/:roomId/messages` with `kind: "reply"`. */
export interface PostReplyRequest {
  kind: "reply";
  displayName: string;
  body: string;
}

/**
 * A Relay attempt: `POST /api/rooms/:roomId/messages` with `kind: "relay"`.
 * Requires the Host credential; the Server also requires the `@agent`
 * marker and a connected Daemon before accepting it.
 */
export interface PostRelayRequest {
  kind: "relay";
  hostCredential: HostCredential;
  body: string;
}

export type PostMessageRequest = PostReplyRequest | PostRelayRequest;

/** Why a message attempt was rejected and not stored. */
export type RelayRejectionReason =
  | "room-not-found"
  | "not-host"
  | "daemon-disconnected"
  | "missing-agent-marker";

export type PostMessageResponse =
  | { ok: true; entry: TranscriptEntry }
  | { ok: false; error: RelayRejectionReason };

/* ---------------------------------------------------------------------- */
/* WebSocket contract                                                     */
/* ---------------------------------------------------------------------- */

/** A web client subscribing to live Transcript and presence for one Room. */
export interface SubscribeMessage {
  type: "subscribe";
  roomId: string;
}

/** The Daemon announcing it now holds a connection for this Room. */
export interface DaemonConnectMessage {
  type: "daemon-connect";
  roomId: string;
  hostCredential: HostCredential;
}

/** The Daemon announcing it is dropping its connection for this Room. */
export interface DaemonDisconnectMessage {
  type: "daemon-disconnect";
  roomId: string;
  hostCredential: HostCredential;
}

/**
 * The Daemon publishing the Agent's final answer for one run back into the
 * Room. One message per completed run (no partial streaming in this POC).
 */
export interface AgentPublicationMessage {
  type: "agent-publication";
  roomId: string;
  hostCredential: HostCredential;
  body: string;
}

/** Messages a client (web app or Daemon) sends to the Server over WebSocket. */
export type ClientToServerMessage =
  | SubscribeMessage
  | DaemonConnectMessage
  | DaemonDisconnectMessage
  | AgentPublicationMessage;

/** A new Transcript entry, broadcast to every subscriber of the Room. */
export interface TranscriptEntryMessage {
  type: "transcript-entry";
  roomId: string;
  entry: TranscriptEntry;
}

/** A change in whether the Room's Daemon is connected, broadcast to subscribers. */
export interface PresenceMessage {
  type: "presence";
  roomId: string;
  daemonConnected: boolean;
}

/**
 * The Server delivering an accepted Relay's payload text to the Daemon that
 * holds the matching Host credential for this Room. Sent only to that
 * Daemon connection, never broadcast to web subscribers.
 */
export interface RelayDeliveryMessage {
  type: "relay-delivery";
  roomId: string;
  relayId: string;
  payload: string;
}

/** An error reported back to the sender of a WebSocket message. */
export interface ErrorMessage {
  type: "error";
  message: string;
}

/** Messages the Server sends to a client over WebSocket. */
export type ServerToClientMessage =
  | TranscriptEntryMessage
  | PresenceMessage
  | RelayDeliveryMessage
  | ErrorMessage;
