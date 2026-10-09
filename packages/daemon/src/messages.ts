import type {
  AgentPublicationMessage,
  DaemonConnectMessage
} from "@collaborative-grill/shared";

/** Builds the wire message the Daemon sends on startup for one Room it serves. */
export function buildDaemonConnectMessage(
  roomId: string,
  hostCredential: string
): DaemonConnectMessage {
  return { type: "daemon-connect", roomId, hostCredential };
}

/** Builds the wire message publishing the Agent's final answer for one run. */
export function buildAgentPublicationMessage(
  roomId: string,
  hostCredential: string,
  body: string
): AgentPublicationMessage {
  return { type: "agent-publication", roomId, hostCredential, body };
}
