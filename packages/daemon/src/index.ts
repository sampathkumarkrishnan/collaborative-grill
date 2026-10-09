/**
 * Daemon process entrypoint. Reads the Host credential and the Server's
 * WebSocket address from the environment, builds the real Cursor SDK
 * adapter when `CURSOR_API_KEY` is set (falling back to the fake adapter
 * otherwise, e.g. in CI without Cursor installed), and connects. See
 * `docs/protocol.md` and `CONTEXT.md` for the wire contract and
 * vocabulary this implements.
 *
 * `ROOM_IDS` is a stopgap: full Room discovery for a Host's Daemon is
 * Server/Room integration work (ticket 7), out of scope here. Until then
 * this reads a static comma-separated list of Room ids to announce.
 */
import { createDaemonClient } from "./daemonClient.js";
import { createCursorSdkAdapter, createFakeSdkAdapter, type AgentSdkAdapter } from "./sdkAdapter.js";

function parseRoomIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/** Real Cursor SDK when `CURSOR_API_KEY` and a `cwd` are both available; fake otherwise. */
function buildSdkAdapter(): AgentSdkAdapter {
  const apiKey = process.env.CURSOR_API_KEY;
  const cwd = process.env.CURSOR_AGENT_CWD ?? process.cwd();

  if (apiKey) {
    return createCursorSdkAdapter({ apiKey, cwd, model: process.env.CURSOR_AGENT_MODEL });
  }

  return createFakeSdkAdapter();
}

function main(): void {
  const hostCredential = process.env.HOST_CREDENTIAL;

  if (!hostCredential) {
    // eslint-disable-next-line no-console
    console.log(
      "Daemon not started: set HOST_CREDENTIAL (and ROOM_IDS) and connect to the Server's " +
        "/ws endpoint (see docs/protocol.md)."
    );
    return;
  }

  const serverUrl = process.env.SERVER_WS_URL ?? "ws://localhost:4000/ws";
  const roomIds = parseRoomIds(process.env.ROOM_IDS);

  const client = createDaemonClient({
    serverUrl,
    hostCredential,
    roomIds,
    sdkAdapter: buildSdkAdapter(),
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error("Daemon error:", error.message);
    }
  });

  client
    .connect()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log(
        `Daemon connected to ${serverUrl} for Room(s): ${roomIds.join(", ") || "(none configured)"}`
      );
    })
    .catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error("Daemon failed to connect:", error);
    });
}

main();
