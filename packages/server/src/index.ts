import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createMockRoomStore } from "./store.js";
import { attachWebSocketServer } from "./ws.js";

const port = Number(process.env.PORT ?? 4000);

const store = createMockRoomStore();
const app = createApp(store);
const httpServer = createServer(app);
attachWebSocketServer(httpServer, store);

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Stub Server listening on http://localhost:${port} (contract: docs/protocol.md)`);
});
