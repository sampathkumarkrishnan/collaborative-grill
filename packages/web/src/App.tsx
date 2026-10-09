import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "./api.js";
import { HomePage } from "./HomePage.js";
import { parseRoute } from "./router.js";
import { RoomPage } from "./RoomPage.js";
import { defaultBrowserStorage, type BrowserStorage } from "./storage.js";
import type { SocketFactory } from "./ws.js";

export interface AppProps {
  /** Overridable for tests; production builds a default client against the configured Server. */
  apiClient?: ApiClient;
  /** Overrides browser storage (tests only). */
  storage?: BrowserStorage;
  /** Overrides the WebSocket constructor used by any open Room (tests only). */
  createSocket?: SocketFactory;
  socketUrl?: string;
  /** Overrides the initial route instead of reading `window.location` (tests only). */
  initialPath?: string;
}

/**
 * Web app shell: Home (created/visited Room lists, create-Room) and one
 * open Room at a time, reached either by creating a Room or by opening a
 * Link. Uses `history.pushState` for in-app navigation so a shared Link
 * still works as a normal URL on first load.
 */
export function App({
  apiClient,
  storage = defaultBrowserStorage,
  createSocket,
  socketUrl,
  initialPath
}: AppProps): JSX.Element {
  const client = useMemo(() => apiClient ?? new ApiClient(), [apiClient]);
  const [path, setPath] = useState(
    () => initialPath ?? (typeof window !== "undefined" ? window.location.pathname : "/")
  );

  useEffect(() => {
    function handlePopState(): void {
      setPath(window.location.pathname);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(link: string): void {
    if (typeof window !== "undefined" && window.history?.pushState) {
      window.history.pushState({}, "", link);
    }
    setPath(link);
  }

  const route = parseRoute(path);

  if (route.type === "room") {
    return (
      <RoomPage
        key={route.link}
        link={route.link}
        apiClient={client}
        storage={storage}
        onBack={() => navigate("/")}
        createSocket={createSocket}
        socketUrl={socketUrl}
      />
    );
  }

  return <HomePage apiClient={client} storage={storage} onNavigate={navigate} />;
}
