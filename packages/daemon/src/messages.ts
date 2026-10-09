import type {
  AgentPublicationMessage,
  DaemonConnectMessage,
  DaemonDisconnectMessage,
  HostCredential
} from "@collaborative-grill/shared";

/** Builds the wire message the Daemon sends on startup for one Room it serves. */
export function buildDaemonConnectMessage(
  roomId: string,
  hostCredential: HostCredential
): DaemonConnectMessage {
  return { type: "daemon-connect", roomId, hostCredential };
}

/** Builds the wire message the Daemon sends when dropping its connection for one Room. */
export function buildDaemonDisconnectMessage(
  roomId: string,
  hostCredential: HostCredential
): DaemonDisconnectMessage {
  return { type: "daemon-disconnect", roomId, hostCredential };
}

/** Builds the wire message publishing the Agent's final answer for one run. */
export function buildAgentPublicationMessage(
  roomId: string,
  hostCredential: HostCredential,
  body: string
): AgentPublicationMessage {
  return { type: "agent-publication", roomId, hostCredential, body };
}
