/**
 * The marker a Member types in the composer to request a Relay. Per the
 * hackathon spec, only the Host's message is accepted as a Relay when the
 * body contains this marker; everyone else's `@agent` text is rejected
 * upstream (see `docs/protocol.md`).
 */
export const AGENT_MARKER = "@agent";

export interface RelayParseResult {
  /** Whether the body contains the `@agent` marker and is a Relay candidate. */
  isRelay: boolean;
  /**
   * The message text after the marker, trimmed. `null` when `isRelay` is
   * `false`. This is the payload text forwarded to the Daemon, per
   * "Payload text is the message after the `@agent` marker, trimmed."
   */
  payload: string | null;
}

/**
 * Determine whether a composed message is a Relay candidate and extract the
 * payload text that would be delivered to the Daemon. This performs no
 * authorization (Host role) or connectivity (Daemon presence) checks -
 * those are Room module concerns.
 */
export function parseRelayCandidate(body: string): RelayParseResult {
  const markerIndex = body.indexOf(AGENT_MARKER);
  if (markerIndex === -1) {
    return { isRelay: false, payload: null };
  }

  const payload = body.slice(markerIndex + AGENT_MARKER.length).trim();
  return { isRelay: true, payload };
}
