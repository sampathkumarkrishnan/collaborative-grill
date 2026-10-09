/**
 * Server location for the web app's HTTP and WebSocket clients. Overridable
 * at build time via `VITE_SERVER_URL` (see `.env` files Vite supports);
 * defaults to the stub Server's local dev port from `docs/protocol.md`.
 */
function viteEnv(): Record<string, string | undefined> {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  return meta.env ?? {};
}

export function getServerHttpUrl(): string {
  const configured = viteEnv().VITE_SERVER_URL;
  return (configured ?? "http://localhost:4000").replace(/\/+$/, "");
}

/** Derives the `/ws` endpoint URL from the HTTP Server URL. */
export function getServerWsUrl(): string {
  const httpUrl = getServerHttpUrl();
  const wsUrl = httpUrl.replace(/^http/, "ws");
  return `${wsUrl}/ws`;
}
