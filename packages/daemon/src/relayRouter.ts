import type {
  AgentPublicationMessage,
  HostCredential,
  RelayDeliveryMessage
} from "@collaborative-grill/shared";
import type { AgentPool } from "./agentPool.js";
import { buildAgentPublicationMessage } from "./messages.js";

/**
 * Sends one wire `agent-publication` message. Named distinctly from
 * Room `publishAgentMessage`, which appends to the Transcript - a
 * different concept on the Server side of the same wire message.
 */
export type SendAgentPublication = (message: AgentPublicationMessage) => void;

export interface RelayRouter {
  routeRelayDelivery(message: RelayDeliveryMessage): Promise<void>;
}

/**
 * Routes one `relay-delivery` to its Room's Agent and publishes exactly
 * one `agent-publication` once the run's buffered text is ready. Nothing
 * reaches `publish` before `agent.send`'s run has fully finished - per
 * `docs/spec-hackathon-poc.md`, "no partial stream to Server" and "one
 * final message per run".
 */
export function createRelayRouter(
  pool: AgentPool,
  hostCredential: HostCredential,
  publish: SendAgentPublication
): RelayRouter {
  async function routeRelayDelivery(message: RelayDeliveryMessage): Promise<void> {
    const agent = await pool.getOrCreate(message.roomId);
    const run = await agent.send(message.payload);
    const body = await run.text();
    publish(buildAgentPublicationMessage(message.roomId, hostCredential, body));
  }

  return { routeRelayDelivery };
}
