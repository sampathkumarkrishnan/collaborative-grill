import { setupServer } from "msw/node";

/** Shared MSW Node server; individual tests add handlers with `server.use(...)`. */
export const server = setupServer();
