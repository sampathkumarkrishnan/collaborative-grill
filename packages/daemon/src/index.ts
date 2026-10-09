/**
 * Library surface for `@collaborative-grill/daemon`. Pure re-exports, no
 * side effects on import - safe to embed a Daemon in another package's
 * tests (e.g. `packages/server/test/daemon-integration.test.ts`). The
 * process entrypoint (`pnpm dev:daemon` / `start`) is `cli.ts`, which
 * connects on load; it is not re-exported here.
 */
export { createDaemonClient, type DaemonClient, type DaemonClientOptions } from "./daemonClient.js";
export { createAgentPool, type AgentPool } from "./agentPool.js";
export {
  createRelayRouter,
  type RelayRouter,
  type SendAgentPublication
} from "./relayRouter.js";
export {
  createCursorSdkAdapter,
  createFakeSdkAdapter,
  type AgentHandle,
  type AgentRun,
  type AgentSdkAdapter,
  type CursorSdkAdapterOptions
} from "./sdkAdapter.js";
export {
  buildAgentPublicationMessage,
  buildDaemonConnectMessage,
  buildDaemonDisconnectMessage
} from "./messages.js";
