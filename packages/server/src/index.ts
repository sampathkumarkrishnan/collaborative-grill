import { createServer } from "node:http";
import { join } from "node:path";
import { createApp } from "./app.js";
import { createRoomStore } from "./store.js";
import { attachWebSocketServer } from "./ws.js";

const port = Number(process.env.PORT ?? 4000);
const dbPath = process.env.SQLITE_PATH ?? join(process.cwd(), "data", "server.sqlite");

const store = createRoomStore(dbPath);
const app = createApp(store);
const httpServer = createServer(app);
attachWebSocketServer(httpServer, store);

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port} (sqlite: ${dbPath})`);
});
