import { AGENT_MARKER, parseRelayCandidate, type PostMessageRequest } from "@collaborative-grill/shared";

export interface ComposerContext {
  /** The browser-local display name to attach to a Reply. */
  displayName: string;
  /** Whether this browser holds the Host credential for the Room. */
  isHost: boolean;
  /** The Host credential, present only when `isHost` is true. */
  hostCredential?: string;
}

export type ComposerDecision =
  | { kind: "reply"; request: PostMessageRequest }
  | { kind: "relay"; request: PostMessageRequest }
  | { kind: "blocked"; reason: string };

/**
 * Applies the `@agent` rule (`docs/protocol.md`, `docs/spec-hackathon-poc.md`)
 * client-side: a message containing the marker is a Relay attempt, but only
 * the Host can actually send one. A non-Host's `@agent` text is blocked
 * before it ever reaches the Server, matching "Members do not send Relays."
 * The Server remains the final authority - an accepted-looking Relay here
 * can still be rejected (e.g. the Daemon is disconnected).
 */
export function decideMessageRequest(body: string, context: ComposerContext): ComposerDecision {
  const trimmed = body.trim();
  const candidate = parseRelayCandidate(trimmed);

  if (!candidate.isRelay) {
    return {
      kind: "reply",
      request: { kind: "reply", displayName: context.displayName, body: trimmed }
    };
  }

  if (!context.isHost || !context.hostCredential) {
    return {
      kind: "blocked",
      reason: `Only the Host can use ${AGENT_MARKER} to Relay to the Agent.`
    };
  }

  return {
    kind: "relay",
    request: { kind: "relay", hostCredential: context.hostCredential, body: trimmed }
  };
}
