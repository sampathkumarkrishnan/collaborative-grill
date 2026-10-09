/**
 * Daemon process entrypoint shell. Ticket "4: Daemon module" builds out the
 * Server WebSocket client, the Relay router, and the Cursor SDK Agent pool
 * described in `docs/protocol.md` and `CONTEXT.md`. For now this confirms
 * the package boots and resolves the shared contract types.
 */
import { buildDaemonConnectMessage } from "./messages.js";

const hostCredential = process.env.HOST_CREDENTIAL;

if (!hostCredential) {
  // eslint-disable-next-line no-console
  console.log(
    "Daemon shell started. Set HOST_CREDENTIAL and connect to the Server's /ws endpoint " +
      "(see docs/protocol.md) once the Daemon module (ticket 4) lands."
  );
} else {
  // eslint-disable-next-line no-console
  console.log("Daemon shell ready to connect:", buildDaemonConnectMessage("<roomId>", hostCredential));
}
