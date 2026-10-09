/**
 * The three Transcript entry kinds, per `CONTEXT.md`:
 * - `reply`: a Member message that does not invoke the Agent.
 * - `relay`: a Host message that invoked the Agent and was accepted.
 * - `agent`: an assistant message published by the Daemon after a run.
 */
export type TranscriptEntryKind = "reply" | "relay" | "agent";

interface TranscriptEntryBase {
  id: string;
  roomId: string;
  kind: TranscriptEntryKind;
  /** The stored message text, in composer order. */
  body: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface ReplyEntry extends TranscriptEntryBase {
  kind: "reply";
  /** Browser-local label only; not an authorization. */
  authorDisplayName: string;
}

export interface RelayEntry extends TranscriptEntryBase {
  kind: "relay";
  /** Always the Host's display name; Relays are Host-only. */
  authorDisplayName: string;
  /** The message text after the `@agent` marker, trimmed. Delivered to the Daemon. */
  payload: string;
}

export interface AgentEntry extends TranscriptEntryBase {
  kind: "agent";
}

/** A single Transcript entry: Reply, Relay, or Agent. */
export type TranscriptEntry = ReplyEntry | RelayEntry | AgentEntry;
